import React from 'react';
import { LegalDoc } from '../components/LegalDoc';
import { OPERATOR, DOC_DATES, LEGAL_BASIS } from '../lib/legal';

const SECTIONS = [
  {
    id: 'pham-vi',
    heading: 'Phạm vi và bên kiểm soát dữ liệu',
    body: (
      <>
        <p>
          Chính sách này mô tả cách tsudev thu thập, sử dụng, lưu trữ, chia sẻ và bảo vệ dữ liệu cá
          nhân của bạn khi bạn truy cập và sử dụng các dịch vụ tại tsudev, bao gồm trang chính, diễn
          đàn, blog, kho tài liệu, chợ và hệ thống Con dấu tín nhiệm.
        </p>
        <p>
          Bên Kiểm soát dữ liệu cá nhân là <strong>{OPERATOR.legalName}</strong> (mã số{' '}
          {OPERATOR.taxCode}), địa chỉ {OPERATOR.address}
          {OPERATOR.owner !== OPERATOR.legalName ? `, do ${OPERATOR.owner} đại diện` : ''}. Mọi yêu
          cầu liên quan đến dữ liệu cá nhân xin gửi tới <strong>{OPERATOR.privacyEmail}</strong>.
        </p>
        <p>
          Chính sách được xây dựng trên cơ sở Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực
          từ 01/01/2026) và Nghị định số 356/2025/NĐ-CP ngày 31/12/2025 quy định chi tiết thi hành
          Luật này.
        </p>
      </>
    ),
  },
  {
    id: 'du-lieu-thu-thap',
    heading: 'Dữ liệu cá nhân chúng tôi xử lý',
    body: (
      <>
        <p>
          Chúng tôi phân loại dữ liệu theo đúng cách phân loại của pháp luật: dữ liệu cá nhân cơ bản
          và dữ liệu cá nhân nhạy cảm.
        </p>
        <h3>Dữ liệu cá nhân cơ bản</h3>
        <ul>
          <li>
            <strong>Dữ liệu tài khoản:</strong> họ tên hoặc tên hiển thị, tên đăng nhập, địa chỉ thư
            điện tử, ảnh đại diện, mô tả hồ sơ. Thu thập trực tiếp từ bạn khi đăng ký, hoặc từ nhà
            cung cấp định danh khi bạn chọn đăng nhập một lần (SSO).
          </li>
          <li>
            <strong>Dữ liệu xác thực:</strong> số điện thoại di động tại Việt Nam hoặc số định danh
            cá nhân, trong phạm vi bắt buộc theo điểm e khoản 3 Điều 23 Nghị định số 147/2024/NĐ-CP.
          </li>
          <li>
            <strong>Nội dung bạn tạo ra:</strong> chủ đề, bài viết, bình luận, tài liệu, tin nhắn,
            tin đăng trên chợ, hồ sơ đăng ký Con dấu tín nhiệm và các tệp bạn tải lên.
          </li>
          <li>
            <strong>Dữ liệu kỹ thuật:</strong> địa chỉ IP, loại trình duyệt và thiết bị, hệ điều
            hành, thời điểm truy cập, trang giới thiệu, nhật ký lỗi và nhật ký bảo mật.
          </li>
        </ul>
        <h3>Dữ liệu cá nhân nhạy cảm</h3>
        <p>
          tsudev không chủ động thu thập dữ liệu cá nhân nhạy cảm. Nếu một tính năng cụ thể cần đến
          loại dữ liệu này, chúng tôi sẽ thông báo riêng và chỉ xử lý sau khi có sự đồng ý rõ ràng,
          tách bạch của bạn cho đúng mục đích đó. Bạn không nên đăng dữ liệu nhạy cảm của mình hoặc
          của người khác vào nội dung công khai.
        </p>
        <h3>Dữ liệu của trẻ em</h3>
        <p>
          Dịch vụ không dành cho người dưới 16 tuổi. Việc xử lý dữ liệu cá nhân của trẻ em chỉ được
          thực hiện khi có sự đồng ý của cha, mẹ hoặc người giám hộ theo quy định của pháp luật. Nếu
          phát hiện đã thu thập dữ liệu trẻ em không đúng quy định, chúng tôi sẽ ngừng xử lý và xóa
          dữ liệu đó.
        </p>
      </>
    ),
  },
  {
    id: 'muc-dich',
    heading: 'Mục đích và căn cứ xử lý',
    body: (
      <>
        <p>
          Chúng tôi chỉ xử lý dữ liệu cho các mục đích đã thông báo dưới đây, không mở rộng sang mục
          đích khác nếu chưa thông báo và chưa có căn cứ hợp pháp mới.
        </p>
        <ul>
          <li>
            <strong>Cung cấp dịch vụ:</strong> tạo và quản lý tài khoản, đăng nhập, hiển thị nội
            dung bạn đăng, gửi và nhận tin nhắn, vận hành chợ và Con dấu tín nhiệm.
          </li>
          <li>
            <strong>Bảo đảm an toàn:</strong> phát hiện và ngăn chặn truy cập trái phép, gian lận,
            thư rác, tấn công hệ thống; điều tra sự cố; lưu nhật ký phục vụ kiểm tra bảo mật.
          </li>
          <li>
            <strong>Kiểm duyệt nội dung:</strong> tiếp nhận báo cáo vi phạm, gỡ bỏ nội dung vi phạm
            pháp luật và xử lý tài khoản vi phạm nội quy.
          </li>
          <li>
            <strong>Cải thiện sản phẩm:</strong> phân tích tổng hợp, ẩn danh về mức độ sử dụng nhằm
            nâng cao chất lượng dịch vụ.
          </li>
          <li>
            <strong>Liên lạc:</strong> gửi thông báo về tài khoản, thay đổi điều khoản, cảnh báo bảo
            mật. Thư quảng bá chỉ gửi khi bạn đã đồng ý và luôn kèm cách từ chối nhận.
          </li>
          <li>
            <strong>Tuân thủ pháp luật:</strong> thực hiện yêu cầu hợp pháp của cơ quan nhà nước có
            thẩm quyền và các nghĩa vụ lưu trữ theo quy định.
          </li>
        </ul>
        <p>
          Phần lớn hoạt động xử lý dựa trên sự đồng ý của bạn khi đăng ký tài khoản và trên việc
          thực hiện hợp đồng cung cấp dịch vụ. Một số trường hợp được pháp luật cho phép xử lý không
          cần sự đồng ý, chẳng hạn để bảo vệ tính mạng, sức khỏe của cá nhân, phục vụ quốc phòng, an
          ninh quốc gia, hoặc theo yêu cầu của cơ quan có thẩm quyền.
        </p>
      </>
    ),
  },
  {
    id: 'quyen-cua-ban',
    heading: 'Quyền của bạn với tư cách chủ thể dữ liệu',
    body: (
      <>
        <p>
          Theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, bạn có các quyền sau và chúng tôi có
          nghĩa vụ tạo điều kiện, không được cản trở việc thực hiện các quyền này:
        </p>
        <ul>
          <li>
            <strong>Quyền được biết</strong> về hoạt động xử lý dữ liệu cá nhân của mình.
          </li>
          <li>
            <strong>Quyền đồng ý hoặc không đồng ý</strong> cho phép xử lý dữ liệu cá nhân.
          </li>
          <li>
            <strong>Quyền rút lại sự đồng ý</strong> bất kỳ lúc nào. Việc rút lại phải dễ dàng như
            khi bạn đã đồng ý và không làm ảnh hưởng tới tính hợp pháp của hoạt động xử lý đã thực
            hiện trước đó.
          </li>
          <li>
            <strong>Quyền truy cập,</strong> xem, chỉnh sửa hoặc yêu cầu chỉnh sửa dữ liệu cá nhân
            của mình.
          </li>
          <li>
            <strong>Quyền yêu cầu cung cấp</strong> dữ liệu cá nhân mà chúng tôi đang giữ.
          </li>
          <li>
            <strong>Quyền yêu cầu xóa</strong> dữ liệu cá nhân, trừ trường hợp pháp luật có quy định
            khác về lưu trữ.
          </li>
          <li>
            <strong>Quyền yêu cầu hạn chế xử lý</strong> dữ liệu cá nhân.
          </li>
          <li>
            <strong>Quyền phản đối</strong> hoạt động xử lý dữ liệu cá nhân.
          </li>
          <li>
            <strong>Quyền khiếu nại, tố cáo, khởi kiện</strong> và{' '}
            <strong>yêu cầu bồi thường thiệt hại</strong> theo quy định của pháp luật.
          </li>
          <li>
            <strong>Quyền yêu cầu cơ quan có thẩm quyền</strong> áp dụng biện pháp bảo vệ dữ liệu cá
            nhân của mình.
          </li>
        </ul>
        <h3>Cách thực hiện quyền</h3>
        <p>
          Bạn có thể tự chỉnh sửa phần lớn thông tin ngay trong trang hồ sơ cá nhân. Với các yêu cầu
          khác, hãy gửi thư tới <strong>{OPERATOR.privacyEmail}</strong> kèm thông tin đủ để xác
          minh bạn là chủ tài khoản. Chúng tôi phản hồi và thực hiện yêu cầu{' '}
          <strong>trong vòng 72 giờ</strong> kể từ khi nhận được yêu cầu hợp lệ, trừ trường hợp pháp
          luật quy định khác. Nếu từ chối, chúng tôi sẽ nêu rõ lý do bằng văn bản.
        </p>
        <p>
          Xin lưu ý: việc xóa tài khoản không đương nhiên xóa các bài viết công khai mà người khác
          đã trích dẫn hoặc trả lời. Bạn có thể yêu cầu gỡ riêng từng nội dung trước khi xóa tài
          khoản.
        </p>
      </>
    ),
  },
  {
    id: 'chia-se',
    heading: 'Chia sẻ dữ liệu và chuyển ra nước ngoài',
    body: (
      <>
        <p>
          Chúng tôi <strong>không mua, bán</strong> dữ liệu cá nhân dưới mọi hình thức. Pháp luật
          nghiêm cấm hành vi này và áp dụng mức phạt lên tới 10 lần khoản thu có được từ vi phạm.
        </p>
        <p>Dữ liệu chỉ được chia sẻ trong các trường hợp sau:</p>
        <ul>
          <li>
            <strong>Bên Xử lý dữ liệu:</strong> các nhà cung cấp hạ tầng, lưu trữ, gửi thư và giám
            sát mà chúng tôi thuê. Họ chỉ được xử lý theo đúng chỉ dẫn của chúng tôi, trên cơ sở hợp
            đồng có điều khoản bảo vệ dữ liệu.
          </li>
          <li>
            <strong>Nội dung bạn chủ động công khai:</strong> thông tin tổ chức và tên miền trong hồ
            sơ đăng ký Con dấu tín nhiệm là công khai với mọi người truy cập, kể cả người chưa đăng
            nhập.
          </li>
          <li>
            <strong>Cơ quan nhà nước có thẩm quyền:</strong> khi có yêu cầu hợp pháp bằng văn bản.
          </li>
        </ul>
        <p>
          Trường hợp có chuyển dữ liệu cá nhân của công dân Việt Nam ra nước ngoài, chúng tôi thực
          hiện đánh giá tác động chuyển dữ liệu ra nước ngoài và nộp hồ sơ cho cơ quan có thẩm quyền
          trong thời hạn 60 ngày kể từ ngày chuyển, theo quy định của Luật Bảo vệ dữ liệu cá nhân
          2025 và Nghị định số 356/2025/NĐ-CP.
        </p>
      </>
    ),
  },
  {
    id: 'luu-tru-bao-mat',
    heading: 'Lưu trữ và biện pháp bảo mật',
    body: (
      <>
        <p>
          Chúng tôi chỉ lưu dữ liệu trong thời gian cần thiết cho mục đích đã nêu. Cụ thể: dữ liệu
          tài khoản được lưu trong suốt thời gian tài khoản còn hoạt động; nhật ký kỹ thuật và nhật
          ký bảo mật được lưu tối đa 24 tháng; dữ liệu phục vụ nghĩa vụ pháp lý được lưu theo đúng
          thời hạn mà pháp luật chuyên ngành yêu cầu. Hết thời hạn, dữ liệu được xóa hoặc ẩn danh
          hóa.
        </p>
        <p>Các biện pháp bảo vệ đang áp dụng:</p>
        <ul>
          <li>Mã hóa đường truyền bằng TLS cho toàn bộ kết nối tới dịch vụ.</li>
          <li>
            Không lưu mật khẩu dạng rõ; xác thực qua nhà cung cấp định danh với phiên làm việc có
            thời hạn.
          </li>
          <li>
            Phân quyền theo vai trò, giới hạn nhân sự được tiếp cận dữ liệu theo nguyên tắc tối
            thiểu.
          </li>
          <li>Ghi nhật ký truy cập quản trị và giám sát bất thường.</li>
          <li>Sao lưu định kỳ và kiểm thử khôi phục.</li>
        </ul>
        <p>
          Khi xảy ra sự cố xâm phạm dữ liệu cá nhân, chúng tôi thông báo cho cơ quan có thẩm quyền
          và cho bạn theo đúng thời hạn và trình tự mà pháp luật quy định, kèm mô tả sự cố, hậu quả
          có thể xảy ra và biện pháp khắc phục.
        </p>
      </>
    ),
  },
  {
    id: 'cookie',
    heading: 'Cookie và công nghệ tương tự',
    body: (
      <>
        <p>tsudev sử dụng cookie ở mức tối thiểu cần thiết:</p>
        <ul>
          <li>
            <strong>Cookie thiết yếu:</strong> duy trì phiên đăng nhập và chống giả mạo yêu cầu
            (CSRF). Không thể tắt vì dịch vụ sẽ không hoạt động.
          </li>
          <li>
            <strong>Cookie tùy chọn giao diện:</strong> ghi nhớ lựa chọn hiển thị của bạn.
          </li>
        </ul>
        <p>
          Chúng tôi không đặt cookie quảng cáo của bên thứ ba và không theo dõi bạn trên các trang
          web khác. Bạn có thể xóa hoặc chặn cookie trong trình duyệt, nhưng khi đó chức năng đăng
          nhập sẽ không dùng được.
        </p>
      </>
    ),
  },
  {
    id: 'thay-doi',
    heading: 'Thay đổi chính sách và liên hệ',
    body: (
      <>
        <p>
          Khi sửa đổi chính sách, chúng tôi cập nhật ngày hiệu lực ở đầu trang. Với thay đổi ảnh
          hưởng đáng kể đến quyền của bạn, chúng tôi thông báo trước ít nhất 15 ngày qua thư điện tử
          hoặc thông báo trong sản phẩm, và xin lại sự đồng ý nếu pháp luật yêu cầu.
        </p>
        <p>
          Đầu mối bảo vệ dữ liệu cá nhân: <strong>{OPERATOR.privacyEmail}</strong> — điện thoại{' '}
          {OPERATOR.phone} — địa chỉ {OPERATOR.address}.
        </p>
        <p>
          Nếu cho rằng quyền của mình bị xâm phạm, bạn có quyền khiếu nại trực tiếp với chúng tôi,
          tố cáo tới cơ quan chuyên trách bảo vệ dữ liệu cá nhân thuộc Bộ Công an, hoặc khởi kiện
          theo quy định của pháp luật.
        </p>
        <h3>Cơ sở pháp lý</h3>
        <ul>
          {LEGAL_BASIS.map((l) => (
            <li key={l.title}>
              <strong>{l.title}</strong> — {l.note}
            </li>
          ))}
        </ul>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      active="/privacy"
      eyebrow="Pháp lý"
      title="Chính sách quyền riêng tư và bảo vệ dữ liệu cá nhân"
      lead="Cách tsudev thu thập, sử dụng và bảo vệ dữ liệu cá nhân của bạn, cùng các quyền bạn có thể thực hiện bất cứ lúc nào theo Luật Bảo vệ dữ liệu cá nhân 2025."
      effective={DOC_DATES.effective}
      updated={DOC_DATES.updated}
      sections={SECTIONS}
      note={
        <>
          Văn bản này được soạn theo pháp luật Việt Nam hiện hành tại thời điểm cập nhật. Bản tiếng
          Việt là bản có giá trị áp dụng.
        </>
      }
    />
  );
}
