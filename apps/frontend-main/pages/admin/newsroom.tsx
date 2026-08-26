import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, SectionHeading, Badge, Stat } from '@tsudev/ui';
import type { BadgeTone } from '@tsudev/ui';
import Seo from '../../components/Seo';

// Bảng điều khiển Toà soạn Agent AI.
//
// Ba vùng, một nguồn dữ liệu: GET /api/newsroom/state trả về mọi thứ trang này
// cần trong MỘT lượt. Cố ý không tách thành nhiều endpoint - trang poll 3 giây
// một lần, và ba lượt gọi song song sẽ cho ba ảnh chụp lệch nhau, khiến sàn ảo
// và Kanban nói hai chuyện khác nhau về cùng một bản nháp.
//
// Realtime bằng POLL chứ không phải SSE, có chủ đích: frontend chạy opennextjs
// trên Cloudflare Workers, và SSE qua Pages Router ở đó chưa được kiểm chứng
// trong repo này. Poll 3 giây là đủ cho một người xem và không có rủi ro tầng
// biên nào. Hợp đồng dữ liệu đã tách sẵn nên đổi sang SSE sau không đụng UI.

const POLL_MS = 3000;

type AgentStatus = 'IDLE' | 'PLANNING' | 'SCANNING' | 'WRITING' | 'REVIEWING' | 'SUSPENDED';

type DraftStatus =
  | 'IDEA'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'PENDING_HUMAN'
  | 'REJECTED_WITH_FEEDBACK'
  | 'PUBLISHED'
  | 'ARCHIVED';

interface Agent {
  id: string;
  slug: string;
  displayName: string;
  title: string;
  dept: 'RESEARCH' | 'EDITORIAL' | 'PUBLISHING' | 'SEO';
  avatarSeed: string;
  status: AgentStatus;
  statusNote: string | null;
  suspendedAt: string | null;
  model: string;
}

interface Draft {
  id: string;
  target: string;
  status: DraftStatus;
  title: string;
  slug: string | null;
  revisionCount: number;
  reviewFeedback: string | null;
  authorAgentId: string | null;
  updatedAt: string;
}

interface Channel {
  target: string;
  autonomy: 'FULL_AUTO' | 'HUMAN_APPROVAL' | 'DRAFT_ONLY';
  dailyPostCap: number;
  enabled: boolean;
}

interface Source {
  id: string;
  label: string;
  kind: string;
  enabled: boolean;
  lastScanAt: string | null;
  lastError: string | null;
}

interface NewsroomEvent {
  id: string;
  type: string;
  status: string;
  actorKind: string;
  agentId: string | null;
  draftId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface Metrics {
  tokensPerMin: number;
  avgMs: number;
  runs: number;
}

interface ProviderHealth {
  name: 'workers-ai' | 'gemini';
  configured: boolean;
  exhaustedToday: boolean;
}

interface State {
  enabled: boolean;
  budget: { used: number; limit: number };
  /// Hạn mức miễn phí cạn mỗi ngày là THIẾT KẾ, không phải sự cố - nên nó hiện
  /// ra như trạng thái vận hành, không phải như một dòng lỗi đỏ.
  providers: ProviderHealth[];
  deadEvents: number;
  agents: Agent[];
  metrics: Record<string, Metrics>;
  drafts: Draft[];
  /// Id các bản nháp ĐÃ DUYỆT và đang chờ nhịp đăng. Cần vì `Draft.status` chỉ
  /// đổi lúc dispatcher đăng thật, tức tới một giờ sau khi bấm "Duyệt đăng".
  queuedPublish: string[];
  channels: Channel[];
  sources: Source[];
  events: NewsroomEvent[];
  cursor: string | null;
}

// --- Bản đồ hiển thị -------------------------------------------------------
//
// Màu lấy TỪ TOKEN của design system qua `tone` của Badge. Không cắm cứng mã
// hex: `--on-status` đảo theo chế độ sáng/tối còn hex thì không, và mọi cặp màu
// đang bị packages/ui/test/contrast.test.ts canh ở ngưỡng WCAG AA.

const DEPTS: { key: Agent['dept']; label: string }[] = [
  { key: 'RESEARCH', label: 'Phòng Tin Tức' },
  { key: 'EDITORIAL', label: 'Phòng Biên Tập' },
  { key: 'PUBLISHING', label: 'Phòng Kiểm Duyệt' },
  { key: 'SEO', label: 'Phòng SEO' },
];

const AGENT_STATUS: Record<AgentStatus, { label: string; tone: BadgeTone }> = {
  IDLE: { label: 'Nghỉ', tone: 'outline' },
  PLANNING: { label: 'Lên kịch bản', tone: 'teal' },
  SCANNING: { label: 'Đang quét dữ liệu', tone: 'teal' },
  WRITING: { label: 'Đang viết bài', tone: 'brand' },
  REVIEWING: { label: 'Đang thẩm định', tone: 'brand' },
  SUSPENDED: { label: 'Bị treo', tone: 'warning' },
};

const COLUMNS: { key: DraftStatus[]; label: string }[] = [
  { key: ['IDEA'], label: 'Ý tưởng' },
  { key: ['IN_PROGRESS'], label: 'Đang viết' },
  { key: ['PENDING_REVIEW'], label: 'Chờ duyệt' },
  { key: ['REJECTED_WITH_FEEDBACK'], label: 'Cần sửa' },
  { key: ['PENDING_HUMAN'], label: 'Chờ bạn duyệt' },
  { key: ['PUBLISHED'], label: 'Đã đăng' },
];

const EVENT_LABEL: Record<string, string> = {
  'idea.created': 'thêm chủ đề',
  'draft.claimed': 'nhận bài để viết',
  'draft.submitted': 'nộp bản nháp',
  'review.approved': 'duyệt bài',
  'review.rejected': 'trả bài kèm góp ý',
  'review.exhausted': 'hết số vòng sửa, chuyển cho người',
  'review.awaiting_human': 'chờ người duyệt',
  'publish.requested': 'yêu cầu đăng',
  'publish.needs_human': 'cần người chọn dự án đích',
  'draft.published': 'đã đăng bài',
  'agent.suspended': 'bị treo',
  'agent.resumed': 'được mở lại',
  'provider.switched': 'chuyển nhà cung cấp LLM',
  'budget.exhausted': 'cạn hạn mức Neuron',
  'provider.exhausted': 'nhà cung cấp báo cạn hạn mức',
  'event.revived': 'hồi sinh việc đã dừng vì hạn mức',
  'scan.skipped': 'bỏ lượt quét',
  'source.failed': 'nguồn tin lỗi',
  'scan.failed': 'lượt quét lỗi',
  'event.failed': 'xử lý lỗi, sẽ thử lại',
  'event.dead': 'thất bại 3 lần, đã dừng',
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/// Avatar định danh sinh từ hạt giống - không upload ảnh, không kéo
/// storage-service vào một tính năng không cần nó.
function AgentAvatar({ seed, dimmed }: { seed: string; dimmed: boolean }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const initials =
    seed
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'AI';
  return (
    <div
      aria-hidden
      className={`h-10 w-10 shrink-0 rounded-sm border border-line-strong grid place-items-center font-mono text-xs font-bold ${
        dimmed ? 'opacity-40' : ''
      }`}
      style={{ background: `hsl(${h % 360} 45% 50% / 0.18)` }}
    >
      {initials}
    </div>
  );
}

export default function NewsroomPage() {
  const { data: session, status: authStatus } = useSession();
  const [state, setState] = useState<State | null>(null);
  const [log, setLog] = useState<NewsroomEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  /// Kết quả của lần bấm nút gần nhất. Tách khỏi `err` vì phần lớn các lần bấm
  /// KHÔNG lỗi mà vẫn không đổi gì nhìn thấy được - và đó chính là thứ cần nói
  /// ra thành lời.
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = cursor.current ? `?since=${encodeURIComponent(cursor.current)}` : '';
      const res = await fetch(`/api/newsroom/state${qs}`);
      if (res.status === 401 || res.status === 403) {
        setErr('Tài khoản này không có quyền quản trị toà soạn.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: State = await res.json();
      setState(data);
      // Nhật ký tích luỹ ở client: server chỉ gửi phần MỚI hơn con trỏ, nên
      // ghép vào đầu và cắt đuôi. Gửi lại toàn bộ mỗi 3 giây là lãng phí băng
      // thông cho thứ gần như không đổi.
      if (data.events.length) {
        setLog((prev) => [...data.events, ...prev].slice(0, 200));
        cursor.current = data.cursor;
      }
      setErr(null);
    } catch (e) {
      setErr('Không kết nối được toà soạn. Đang thử lại…');
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [session, load]);

  /// Bấm một nút vận hành.
  ///
  /// ⚠️ Bản trước gọi `fetch` rồi VỨT phản hồi đi - không đọc `res.ok`, không
  /// đọc thân. Hậu quả: 401, 404, 500 và `{revived: 0}` trông y hệt thành công,
  /// vì cả bốn đều dẫn tới đúng một việc là `load()` rồi vẽ lại đúng thứ cũ.
  /// Đây là bài học §0.7 "mã 200 không chứng minh trang có nội dung" ở dạng còn
  /// nặng hơn: mã trạng thái thậm chí không được nhìn tới.
  ///
  /// `describe` biến thân phản hồi thành một câu tiếng Việt. Hành động nào
  /// không có gì để nói thì bỏ trống - im lặng lúc đó là đúng, vì kết quả đã
  /// nhìn thấy được trên bảng.
  const act = async (
    key: string,
    url: string,
    body: unknown,
    describe?: (data: Record<string, unknown>) => string | null
  ) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErr(
          typeof data.error === 'string'
            ? `Không thực hiện được: ${data.error}`
            : `Không thực hiện được (HTTP ${res.status}).`
        );
        return;
      }
      setErr(null);
      if (describe) setNotice(describe(data));
      await load();
    } catch {
      setErr('Không gửi được yêu cầu tới toà soạn.');
    } finally {
      setBusy(null);
    }
  };

  // `noindex` phải có ở CẢ hai nhánh chưa-đăng-nhập, không chỉ ở nhánh đã vào
  // được. Trình thu thập của công cụ tìm kiếm KHÔNG BAO GIỜ có phiên, nên trạng
  // thái duy nhất nó nhìn thấy chính là hai nhánh này - đặt thẻ ở nhánh đã đăng
  // nhập là đặt đúng chỗ không ai đọc.
  if (authStatus === 'loading')
    return (
      <Layout>
        <Seo title="Toà soạn Agent AI" path="/admin/newsroom" noindex />
        <Card className="p-8 text-center text-fg-muted">Đang tải…</Card>
      </Layout>
    );

  if (!session)
    return (
      <Layout>
        <Seo title="Toà soạn Agent AI" path="/admin/newsroom" noindex />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-fg mb-2">Toà soạn Agent AI</h1>
          <p className="text-fg-muted mb-4">Khu vực quản trị - cần đăng nhập.</p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );

  const agents = state?.agents ?? [];
  const drafts = state?.drafts ?? [];
  const queuedPublish = state?.queuedPublish ?? [];
  /// Nối vào mọi câu phản hồi khi công tắc tổng đang tắt. Không có nó thì câu
  /// "sẽ chạy ở nhịp kế tiếp" là một lời hứa sai - nhịp kế tiếp cũng sẽ không
  /// làm gì cả.
  const offSuffix =
    state && !state.enabled ? ' ⚠️ Nhưng toà soạn đang TẮT, nên nhịp sẽ không xử lý gì.' : '';
  const nameOf = (id: string | null) => agents.find((a) => a.id === id)?.displayName ?? 'Hệ thống';

  const exhausted = (state?.providers ?? []).filter((p) => p.configured && p.exhaustedToday);

  const budgetPct = state
    ? Math.min(100, Math.round((state.budget.used / state.budget.limit) * 100))
    : 0;

  return (
    <Layout active="/admin" bare>
      <Seo title="Toà soạn Agent AI" path="/admin/newsroom" noindex />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Bảng điều khiển"
          title="Toà soạn Agent AI"
          action={
            <Badge tone={state?.enabled ? 'success' : 'outline'} mono>
              {state?.enabled ? 'ĐANG CHẠY' : 'ĐANG TẮT'}
            </Badge>
          }
        />

        {/* Công tắc tổng tắt = MỌI thứ bên dưới đứng yên, kể cả những nút vẫn bấm
            được. Bản trước để câu này bằng chữ xám ở tận dưới ba thẻ khác, nên
            nó đọc như một ghi chú chứ không như điều kiện chặn - và người dùng
            bấm "Duyệt đăng" rồi chờ mãi không thấy gì. Đưa lên đầu, và nói ra
            HỆ QUẢ chứ không chỉ nói trạng thái. */}
        {state && !state.enabled && (
          <Card className="p-4 mt-6 border-l-2 border-warning">
            <p className="text-sm text-fg">
              <strong>Toà soạn đang TẮT.</strong> Nhịp vẫn tới backend và vẫn trả 202, nhưng
              dispatcher thoát ngay ở dòng đầu - không quét nguồn, không viết bài, và{' '}
              <strong>không xử lý việc bạn duyệt</strong>. Việc đã duyệt nằm chờ trong hàng đợi cho
              tới khi bật lại, không mất đi.
            </p>
            <p className="text-sm text-fg-muted mt-2">
              Bật bằng cách đặt <code className="font-mono text-link">NEWSROOM_ENABLED=true</code> ở
              biến môi trường của backend trên Render.
            </p>
          </Card>
        )}

        {err && (
          <Card className="p-4 mt-6 border-l-2 border-warning">
            <p className="text-sm text-warning">{err}</p>
          </Card>
        )}

        {/* Kết quả của lần bấm nút gần nhất. Phần lớn hành động vận hành ở đây
            KHÔNG đổi gì nhìn thấy được ngay - việc thật xảy ra ở nhịp kế tiếp -
            nên không nói ra thì nút nào cũng trông như nút hỏng. */}
        {notice && (
          <Card className="p-4 mt-6 border-l-2 border-info">
            <p className="text-sm text-fg">{notice}</p>
          </Card>
        )}

        {exhausted.length > 0 && (
          <Card className="p-4 mt-6 border-l-2 border-warning">
            <p className="text-sm text-fg">
              Hết hạn mức miễn phí hôm nay ở {exhausted.map((p) => p.name).join(' và ')}. Toà soạn
              đã <strong>hoãn</strong> việc đang chờ, không huỷ - hạn mức đặt lại lúc{' '}
              <span className="font-mono">00:00 UTC</span> (07:00 giờ Việt Nam).
            </p>
            {!state?.providers?.some((p) => p.name === 'gemini' && p.configured) && (
              <p className="text-sm text-fg-muted mt-2">
                Chưa cấu hình đường dự phòng. Đặt{' '}
                <code className="font-mono text-link">GEMINI_API_KEY</code> ở backend để toà soạn
                chạy tiếp sau khi cạn Neuron.
              </p>
            )}
          </Card>
        )}

        {/* Nút hồi sinh đứng RIÊNG, không lồng trong thẻ cảnh báo hạn mức ở trên.
            Bản đầu lồng nó vào đó và thế là nó chỉ hiện khi HÔM NAY còn nhà cung
            cấp đang cạn hạn mức - tức là biến mất đúng lúc cần dùng nhất: hạn mức
            đã đặt lại, hệ khoẻ trở lại, giờ mới đi dọn xác của hôm trước. Điều
            kiện duy nhất đúng cho nút này là "còn việc chết hay không". */}
        {(state?.deadEvents ?? 0) > 0 && (
          <Card className="p-4 mt-6">
            <p className="text-sm text-fg">
              Có <strong>{state?.deadEvents}</strong> việc đang nằm ở trạng thái đã dừng.
            </p>
            <div className="mt-3">
              <Button
                variant="secondary"
                disabled={busy === 'revive'}
                onClick={() =>
                  act('revive', '/api/newsroom/admin/events/revive', {}, (d) => {
                    const revived = Number(d.revived ?? 0);
                    const keptDead = Number(d.keptDead ?? 0);
                    if (revived === 0)
                      return keptDead > 0
                        ? `Không hồi sinh cái nào. Cả ${keptDead} việc đều chết vì lỗi THẬT, nên chúng cố ý nằm lại để còn sửa - xem nhật ký bên dưới.`
                        : 'Không còn việc nào đã dừng.';
                    return `Đã hồi sinh ${revived} việc. Chúng chạy lại ở nhịp kế tiếp (mỗi giờ, phút :07 UTC)${
                      keptDead > 0 ? `; còn ${keptDead} việc chết vì lỗi thật vẫn nằm nguyên.` : '.'
                    }${offSuffix}`;
                  })
                }
              >
                {busy === 'revive'
                  ? 'Đang hồi sinh…'
                  : `Hồi sinh việc đã dừng (${state?.deadEvents})`}
              </Button>
              <p className="text-sm text-fg-muted mt-2">
                Chỉ hồi sinh việc chết vì lý do TẠM THỜI - cạn hạn mức, hoặc bị bỏ rơi khi tiến
                trình chết giữa chừng. Lỗi thật vẫn nằm nguyên để còn sửa, và số đó được nói rõ sau
                khi bấm.
              </p>
            </div>
          </Card>
        )}

        {/* --- Số đo tổng --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <Card className="p-4">
            <Stat
              value={`${state?.budget.used ?? 0}`}
              label={`/ ${state?.budget.limit ?? 0} Neuron hôm nay`}
            />
            <div className="mt-2 h-1 w-full bg-subtle rounded-sm overflow-hidden">
              <div
                className={budgetPct > 85 ? 'h-full bg-warning' : 'h-full bg-accent'}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </Card>
          <Card className="p-4">
            <Stat
              value={drafts.filter((d) => d.status === 'PUBLISHED').length}
              label="Bài đã đăng"
            />
          </Card>
          <Card className="p-4">
            <Stat
              value={drafts.filter((d) => !['PUBLISHED', 'ARCHIVED'].includes(d.status)).length}
              label="Đang trong dây chuyền"
            />
          </Card>
          <Card className="p-4">
            <Stat
              value={agents.filter((a) => a.status !== 'IDLE' && a.status !== 'SUSPENDED').length}
              label="Nhân sự đang bận"
            />
          </Card>
        </div>

        {/* --- Sàn ảo --- */}
        <h2 className="text-lg font-bold text-fg mt-10 mb-3">Sàn làm việc</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEPTS.map((dept) => (
            <Card key={dept.key} className="p-4">
              <div className="text-xs uppercase tracking-wider text-fg-muted mb-3">
                {dept.label}
              </div>
              <div className="space-y-3">
                {agents
                  .filter((a) => a.dept === dept.key)
                  .map((a) => {
                    const m = state?.metrics[a.id];
                    const st = AGENT_STATUS[a.status];
                    const idle = a.status === 'IDLE' || a.status === 'SUSPENDED';
                    return (
                      <div key={a.id} className="flex gap-3">
                        <AgentAvatar seed={a.avatarSeed} dimmed={idle} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-fg truncate">
                            {a.displayName}
                          </div>
                          <div className="text-xs text-fg-muted truncate">{a.title}</div>
                          <div className="mt-1">
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </div>
                          {a.statusNote && (
                            <div className="text-xs text-fg-muted mt-1 truncate">
                              {a.statusNote}
                            </div>
                          )}
                          <div className="text-xs text-fg-muted mt-1 font-mono tabular-nums">
                            {m?.tokensPerMin ?? 0} tok/phút
                            {m?.avgMs ? ` · ${(m.avgMs / 1000).toFixed(1)}s/lượt` : ''}
                          </div>
                          <button
                            type="button"
                            disabled={busy === a.slug}
                            onClick={() =>
                              act(a.slug, `/api/newsroom/admin/agent/${a.slug}/suspend`, {
                                suspend: !a.suspendedAt,
                              })
                            }
                            className="text-xs underline text-fg-muted hover:text-fg mt-1"
                          >
                            {a.suspendedAt ? 'Mở lại' : 'Tạm treo'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {!agents.some((a) => a.dept === dept.key) && (
                  <p className="text-xs text-fg-muted">Chưa có nhân sự.</p>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* --- Kanban --- */}
        <h2 className="text-lg font-bold text-fg mt-10 mb-3">Luồng sản xuất</h2>
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
          {COLUMNS.map((col) => {
            const items = drafts.filter((d) => col.key.includes(d.status));
            return (
              <Card key={col.label} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-fg-muted">
                    {col.label}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-fg-muted">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 12).map((d) => (
                    <div key={d.id} className="rounded-sm border border-line bg-subtle p-2">
                      <div className="text-xs text-fg line-clamp-3">{d.title}</div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Badge tone="neutral">{d.target}</Badge>
                        {d.revisionCount > 0 && (
                          <Badge tone="outline">sửa {d.revisionCount}×</Badge>
                        )}
                      </div>
                      {d.reviewFeedback && (
                        <details className="mt-1">
                          <summary className="text-xs text-fg-muted cursor-pointer">Góp ý</summary>
                          <p className="text-xs text-fg-muted mt-1 whitespace-pre-wrap">
                            {d.reviewFeedback}
                          </p>
                        </details>
                      )}
                      {d.status === 'PENDING_HUMAN' &&
                        (queuedPublish.includes(d.id) ? (
                          // Đã duyệt nhưng CHƯA đăng. Thẻ phải nói ra điều đó,
                          // nếu không nó trông hệt thẻ chưa bấm và người dùng
                          // bấm lại - `Draft.status` chỉ đổi lúc dispatcher đăng
                          // thật, tức tới một giờ sau.
                          <p className="mt-2 text-xs text-fg-muted">
                            Đã duyệt - chờ nhịp đăng (mỗi giờ, phút :07 UTC).
                          </p>
                        ) : (
                          <Button
                            size="sm"
                            className="mt-2 w-full"
                            disabled={busy === d.id}
                            onClick={() =>
                              act(d.id, `/api/newsroom/admin/draft/${d.id}/approve`, {}, (r) =>
                                r.alreadyQueued
                                  ? `Bản nháp này đã được duyệt từ trước và đang chờ nhịp đăng.${offSuffix}`
                                  : `Đã xếp hàng đăng. Bài lên ở nhịp kế tiếp (mỗi giờ, phút :07 UTC) - thẻ vẫn nằm ở cột này cho tới lúc đó.${offSuffix}`
                              )
                            }
                          >
                            Duyệt đăng
                          </Button>
                        ))}
                    </div>
                  ))}
                  {!items.length && <p className="text-xs text-fg-muted">-</p>}
                </div>
              </Card>
            );
          })}
        </div>

        {/* --- Nhật ký + nguồn --- */}
        <div className="grid lg:grid-cols-3 gap-4 mt-10">
          <Card className="p-4 lg:col-span-2">
            <h2 className="text-lg font-bold text-fg mb-3">Nhật ký hoạt động</h2>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {log.map((e) => (
                <div key={e.id} className="text-xs flex gap-2 py-1 border-b border-line">
                  <span className="font-mono tabular-nums text-fg-muted shrink-0">
                    {timeOf(e.createdAt)}
                  </span>
                  <span className="text-fg">
                    <strong>{e.actorKind === 'human' ? 'Bạn' : nameOf(e.agentId)}</strong>{' '}
                    {EVENT_LABEL[e.type] ?? e.type}
                    {typeof e.payload?.title === 'string' && ` - ${e.payload.title}`}
                    {typeof e.payload?.error === 'string' && (
                      <span className="text-warning"> ({e.payload.error})</span>
                    )}
                  </span>
                </div>
              ))}
              {!log.length && <p className="text-xs text-fg-muted">Chưa có hoạt động nào.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-bold text-fg mb-3">Nguồn săn tin</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(state?.sources ?? []).map((s) => (
                <div key={s.id} className="text-xs border-b border-line pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-fg truncate">{s.label}</span>
                    <Badge tone={s.lastError ? 'warning' : s.enabled ? 'teal' : 'outline'}>
                      {s.kind}
                    </Badge>
                  </div>
                  {s.lastError && <p className="text-warning mt-1">{s.lastError}</p>}
                  {s.lastScanAt && !s.lastError && (
                    <p className="text-fg-muted mt-1">quét lúc {timeOf(s.lastScanAt)}</p>
                  )}
                </div>
              ))}
            </div>

            <h2 className="text-lg font-bold text-fg mt-6 mb-3">Mức tự chủ</h2>
            <div className="space-y-2">
              {(state?.channels ?? []).map((c) => (
                <div key={c.target} className="flex items-center justify-between text-xs">
                  <span className="text-fg">{c.target}</span>
                  <Badge tone={c.autonomy === 'FULL_AUTO' ? 'brand' : 'outline'}>
                    {c.autonomy === 'FULL_AUTO' ? 'tự động' : 'cần duyệt'} · {c.dailyPostCap}/ngày
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
