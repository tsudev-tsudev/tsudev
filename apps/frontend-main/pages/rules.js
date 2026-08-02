import React from 'react';
import { LegalDoc } from '../components/LegalDoc';
import { OPERATOR, DOC_DATES } from '../lib/legal';

const SECTIONS = [
  {
    id: 'tinh-than',
    heading: 'Tinh thần chung',
    body: (
      <>
        <p>
          tsudev là nơi lập trình viên trao đổi chuyên môn. Nội quy này tồn tại để giữ cho các cuộc
          thảo luận có ích, tôn trọng và đáng tin cậy — không phải để hạn chế tranh luận.
        </p>
        <p>
          Nguyên tắc gốc rất đơn giản: <strong>phản biện ý kiến, đừng công kích con người</strong>.
          Bất đồng kỹ thuật là chuyện bình thường và cần thiết; xúc phạm cá nhân thì không.
        </p>
        <p>
          Nội quy này bổ sung cho <a href="/terms">Điều khoản sử dụng</a>. Các hành vi vi phạm pháp
          luật đã nêu trong Điều khoản luôn bị xử lý ở mức nghiêm khắc nhất, bất kể nội quy quy định
          thế nào.
        </p>
      </>
    ),
  },
  {
    id: 'nen-lam',
    heading: 'Nên làm',
    body: (
      <ul>
        <li>
          <strong>Tìm trước khi hỏi.</strong> Nhiều câu hỏi đã có lời giải trong diễn đàn hoặc kho
          tài liệu.
        </li>
        <li>
          <strong>Đặt tiêu đề cụ thể.</strong> “Next.js 13 báo lỗi hydration khi dùng
          useSearchParams” hữu ích hơn nhiều so với “Giúp em với”.
        </li>
        <li>
          <strong>Nêu đủ ngữ cảnh.</strong> Phiên bản, môi trường, thông báo lỗi nguyên văn, những
          gì bạn đã thử.
        </li>
        <li>
          <strong>Định dạng mã bằng khối code.</strong> Ảnh chụp màn hình mã nguồn khiến người khác
          không thể sao chép và tìm kiếm.
        </li>
        <li>
          <strong>Đăng đúng chuyên mục</strong> và dùng thẻ phù hợp.
        </li>
        <li>
          <strong>Dẫn nguồn</strong> khi trích dẫn tài liệu, bài viết hoặc mã nguồn của người khác.
        </li>
        <li>
          <strong>Quay lại đánh dấu lời giải.</strong> Điều này giúp người gặp vấn đề tương tự về
          sau.
        </li>
      </ul>
    ),
  },
  {
    id: 'khong-lam',
    heading: 'Không được làm',
    body: (
      <ul>
        <li>
          <strong>Công kích cá nhân,</strong> mỉa mai, chế giễu người mới hoặc người hỏi câu cơ bản.
        </li>
        <li>
          <strong>Phân biệt đối xử</strong> theo giới tính, dân tộc, tôn giáo, vùng miền, tuổi tác
          hay trình độ.
        </li>
        <li>
          <strong>Quấy rối,</strong> đeo bám, đe dọa, hoặc công khai thông tin cá nhân của người
          khác khi chưa được họ đồng ý.
        </li>
        <li>
          <strong>Spam:</strong> đăng trùng lặp nhiều nơi, quảng cáo trá hình, chèn liên kết tiếp
          thị liên kết mà không khai báo.
        </li>
        <li>
          <strong>Thao túng uy tín:</strong> tạo nhiều tài khoản, nhờ bình chọn, tự trả lời để đẩy
          bài.
        </li>
        <li>
          <strong>Đăng lại nội dung của người khác</strong> như của mình, hoặc chia sẻ phần mềm bẻ
          khóa, tài liệu vi phạm bản quyền.
        </li>
        <li>
          <strong>Chia sẻ mã độc,</strong> công cụ tấn công, hoặc hướng dẫn khai thác nhắm vào hệ
          thống mà bạn không có quyền kiểm thử.
        </li>
        <li>
          <strong>Đưa nội dung không liên quan</strong> về chính trị gây chia rẽ, tôn giáo hoặc nội
          dung người lớn.
        </li>
        <li>
          <strong>Lôi kéo giao dịch ra ngoài</strong> để né trách nhiệm khi dùng tính năng Chợ.
        </li>
      </ul>
    ),
  },
  {
    id: 'ai',
    heading: 'Nội dung tạo bởi trí tuệ nhân tạo',
    body: (
      <>
        <p>
          Bạn được phép dùng công cụ AI để hỗ trợ soạn nội dung, nhưng phải tuân thủ hai điều kiện:
        </p>
        <ul>
          <li>
            <strong>Khai báo rõ</strong> khi phần lớn nội dung do AI tạo ra, nhất là với bài hướng
            dẫn và câu trả lời kỹ thuật.
          </li>
          <li>
            <strong>Tự kiểm chứng trước khi đăng.</strong> Bạn chịu trách nhiệm về nội dung mình
            đăng, kể cả khi do AI viết. Câu trả lời sai do AI bịa ra sẽ bị xử lý như thông tin sai
            lệch thông thường.
          </li>
        </ul>
        <p>
          Nghiêm cấm dùng AI để giả mạo hình ảnh, giọng nói hoặc video của người khác — đây là hành
          vi bị cấm theo Luật An ninh mạng số 116/2025/QH15, không chỉ là vi phạm nội quy.
        </p>
      </>
    ),
  },
  {
    id: 'xu-ly',
    heading: 'Cách xử lý vi phạm',
    body: (
      <>
        <p>Chúng tôi xử lý theo mức độ tăng dần, tùy tính chất và mức độ lặp lại:</p>
        <ul>
          <li>
            <strong>Nhắc nhở</strong> — với lỗi hình thức như sai chuyên mục, thiếu định dạng mã.
          </li>
          <li>
            <strong>Ẩn hoặc gỡ nội dung</strong> — với nội dung vi phạm, kèm lý do gửi tới người
            đăng.
          </li>
          <li>
            <strong>Hạn chế tính năng</strong> — tạm khóa quyền đăng bài từ 7 đến 30 ngày khi tái
            phạm.
          </li>
          <li>
            <strong>Khóa tài khoản vĩnh viễn</strong> — với vi phạm nghiêm trọng: quấy rối có hệ
            thống, lừa đảo, phát tán mã độc, vi phạm pháp luật hình sự.
          </li>
        </ul>
        <p>
          Nội dung vi phạm pháp luật được gỡ bỏ ngay và có thể được chuyển tới cơ quan có thẩm quyền
          theo quy định.
        </p>
      </>
    ),
  },
  {
    id: 'bao-cao',
    heading: 'Báo cáo và khiếu nại',
    body: (
      <>
        <p>
          Gặp nội dung vi phạm, hãy dùng chức năng báo cáo ngay tại bài viết thay vì tranh cãi trong
          chủ đề. Với trường hợp khẩn cấp hoặc liên quan đến an toàn của người khác, gửi thư trực
          tiếp tới <strong>{OPERATOR.abuseEmail}</strong>.
        </p>
        <p>
          Khi báo cáo, hãy nêu đường dẫn và mô tả ngắn gọn vấn đề. Báo cáo sai sự thật với mục đích
          quấy rối người khác cũng là hành vi vi phạm nội quy.
        </p>
        <p>
          Nếu cho rằng quyết định kiểm duyệt là không đúng, bạn có quyền khiếu nại tới{' '}
          <strong>{OPERATOR.email}</strong> trong vòng 30 ngày. Chúng tôi sẽ xem xét lại và trả lời
          bằng văn bản.
        </p>
      </>
    ),
  },
];

export default function RulesPage() {
  return (
    <LegalDoc
      active="/rules"
      eyebrow="Cộng đồng"
      title="Nội quy cộng đồng tsudev"
      lead="Chuẩn mực ứng xử khi thảo luận trên diễn đàn và các không gian cộng đồng của tsudev, cùng cách chúng tôi xử lý vi phạm."
      effective={DOC_DATES.effective}
      updated={DOC_DATES.updated}
      sections={SECTIONS}
      note={
        <>
          Nội quy này bổ sung cho <a href="/terms">Điều khoản sử dụng</a>. Khi có mâu thuẫn, Điều
          khoản sử dụng và pháp luật Việt Nam được ưu tiên áp dụng.
        </>
      }
    />
  );
}
