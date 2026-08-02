import React from 'react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

export const ThreadRow = ({ thread, href }) => {
  const a = thread.author || {};
  return (
    <a
      href={href}
      className="flex items-center gap-4 px-4 py-3 rounded-lg bg-panel hover:bg-panel2 transition-colors group"
    >
      <Avatar name={a.displayName || a.username || '?'} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {thread.pinned && (
            <Badge tone="teal" mono>
              Ghim
            </Badge>
          )}
          {thread.locked && (
            <Badge tone="warning" mono>
              Khoá
            </Badge>
          )}
          <span className="font-semibold text-ink truncate group-hover:text-brandink transition-colors">
            {thread.title}
          </span>
        </div>
        <div className="text-xs text-muted mt-0.5">
          bởi <span className="text-inksoft">{a.displayName || a.username || 'khách'}</span> ·{' '}
          {timeAgo(thread.lastPostAt || thread.createdAt)}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-5 text-center shrink-0">
        <div>
          <div className="font-mono text-sm font-semibold text-ink tabular-nums">
            {thread.replies ?? 0}
          </div>
          <div className="text-[10px] uppercase text-muted">trả lời</div>
        </div>
        <div>
          <div className="font-mono text-sm font-semibold text-ink tabular-nums">
            {thread.views ?? 0}
          </div>
          <div className="text-[10px] uppercase text-muted">lượt xem</div>
        </div>
      </div>
    </a>
  );
};

export default ThreadRow;
