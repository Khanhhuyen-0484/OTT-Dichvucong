const { getChatHistory, sendMessage } = require("../store/supportConversationsStore");
const userStore = require("../store/userStore");
const { getIo } = require("../socket");
const multiChatStore = require("../store/multiChatStore");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { createPresignedPut, isS3Configured } = require("../config/s3");
const { getAiRules, appendAiHistory } = require("../store/adminStore");

const TOPIC_KB = {
  birth: {
    label: "đăng ký khai sinh",
    aliases: ["khai sinh", "giấy khai sinh", "đăng ký khai sinh", "hộ tịch", "khai sinh online"],
    ask: "Đây là đăng ký khai sinh đúng hạn cho trẻ mới sinh hay đăng ký lại giấy khai sinh đã mất/thất lạc?",
    overview:
      "Đăng ký khai sinh là thủ tục hộ tịch cơ bản để xác lập thông tin pháp lý đầu tiên của trẻ. Khi làm thủ tục, người dân thường cần xác định đúng loại hồ sơ là đăng ký đúng hạn hay đăng ký lại, đồng thời chuẩn bị thông tin cha mẹ, nơi cư trú và giấy tờ chứng minh việc sinh.",
    documents:
      "Với đăng ký khai sinh đúng hạn, hồ sơ thường gồm giấy chứng sinh hoặc giấy tờ thay thế, CCCD/căn cước của cha mẹ hoặc người đi đăng ký, và thông tin cư trú để xác định nơi tiếp nhận. Nếu là đăng ký lại, thường cần thêm tài liệu chứng minh thông tin khai sinh trước đây, giấy tờ tùy thân của người yêu cầu và thông tin nơi đã đăng ký lần đầu.",
    steps:
      "Bạn có thể làm theo 3 bước: 1. Chuẩn bị giấy chứng sinh hoặc giấy tờ thay thế cùng giấy tờ tùy thân của người đi đăng ký. 2. Nộp hồ sơ tại UBND cấp xã nơi cư trú của cha hoặc mẹ, hoặc thực hiện trên cổng dịch vụ công nếu địa phương hỗ trợ. 3. Theo dõi kết quả, kiểm tra kỹ thông tin của trẻ và cha mẹ trước khi nhận giấy khai sinh.",
    ontime:
      "Nếu là đăng ký khai sinh đúng hạn, bạn nên chuẩn bị giấy chứng sinh hoặc giấy tờ thay thế, CCCD/căn cước của cha mẹ hoặc người đi đăng ký, và thông tin nơi cư trú để xác định UBND cấp xã có thẩm quyền tiếp nhận. Sau đó bạn có thể nộp trực tiếp hoặc nộp trực tuyến nếu địa phương hỗ trợ.",
    reissue:
      "Nếu là đăng ký lại khai sinh, bạn thường cần tài liệu chứng minh nội dung khai sinh cũ, giấy tờ tùy thân của người yêu cầu và thông tin về nơi đã đăng ký khai sinh trước đây để cơ quan hộ tịch đối chiếu. Trường hợp đăng ký lại thường cần kiểm tra kỹ hơn so với đăng ký đúng hạn.",
    compareVariant:
      "Đăng ký khai sinh đúng hạn thường áp dụng cho trẻ mới sinh và tập trung vào giấy chứng sinh cùng thông tin cha mẹ. Đăng ký lại khai sinh thường áp dụng khi giấy khai sinh cũ bị mất hoặc thất lạc, nên thường cần thêm tài liệu chứng minh nội dung khai sinh trước đây và việc đối chiếu thông tin sẽ chặt hơn.",
    online:
      "Nếu nộp đăng ký khai sinh online, bạn nên chuẩn bị ảnh hoặc bản scan giấy chứng sinh, giấy tờ tùy thân của người đi đăng ký và thông tin cư trú. Sau đó đăng nhập cổng dịch vụ công, chọn đúng thủ tục khai sinh, điền thông tin trẻ và cha mẹ, tải hồ sơ lên rồi theo dõi trạng thái xử lý. Khi cơ quan hộ tịch yêu cầu đối chiếu bản gốc, bạn cần mang giấy tờ thật đến theo hướng dẫn.",
    offline:
      "Nếu nộp trực tiếp, bạn mang hồ sơ đến UBND cấp xã có thẩm quyền, nộp giấy tờ cho bộ phận tiếp nhận, kiểm tra lại thông tin của trẻ và cha mẹ rồi chờ trả kết quả theo giấy hẹn hoặc hướng dẫn tại chỗ.",
    authority:
      "Nơi tiếp nhận thường là UBND cấp xã nơi cư trú của cha hoặc mẹ. Nếu địa phương có hỗ trợ trực tuyến, bạn vẫn cần chọn đúng cơ quan tiếp nhận theo nơi cư trú thực tế.",
    timeline:
      "Thời gian xử lý đăng ký khai sinh thường khá nhanh nếu hồ sơ đầy đủ, nhưng vẫn có thể khác theo địa phương hoặc theo trường hợp đăng ký đúng hạn hay đăng ký lại.",
    result:
      "Kết quả thường là giấy khai sinh hoặc thông tin hộ tịch được ghi nhận hợp lệ theo quy định. Khi nhận kết quả, bạn nên kiểm tra kỹ họ tên, ngày sinh, giới tính, quê quán và thông tin cha mẹ.",
    fees:
      "Nhiều địa phương xử lý đăng ký khai sinh đúng hạn với mức phí rất thấp hoặc không thu phí trong một số trường hợp, nhưng bạn vẫn nên kiểm tra biểu phí tại nơi tiếp nhận để có thông tin chính xác nhất.",
    tips: [
      "Kiểm tra kỹ họ tên, ngày sinh, quê quán của trẻ trước khi xác nhận hồ sơ.",
      "Nếu thiếu giấy chứng sinh, nên hỏi trước cơ quan hộ tịch về giấy tờ thay thế được chấp nhận.",
      "Nếu làm online, hãy chuẩn bị ảnh chụp hoặc bản scan giấy tờ rõ nét."
    ],
    followUps: [
      "Đăng ký khai sinh đúng hạn cần giấy tờ gì?",
      "Đăng ký lại khai sinh khác gì với đúng hạn?",
      "Nộp khai sinh online thế nào?",
      "Khai sinh nộp ở đâu?"
    ]
  },
  residence: {
    label: "đăng ký tạm trú",
    aliases: ["tạm trú", "đăng ký tạm trú", "cư trú", "đăng ký cư trú", "lưu trú", "thuê trọ"],
    ask: "Bạn đang cần hướng dẫn phần hồ sơ cần chuẩn bị, nơi nộp hay các bước nộp tạm trú?",
    overview:
      "Đăng ký tạm trú thường áp dụng khi bạn sinh sống ngoài nơi thường trú trong một khoảng thời gian nhất định. Khi làm thủ tục, điều quan trọng là phải có giấy tờ tùy thân, thông tin chỗ ở và xác định đúng cơ quan tiếp nhận theo nơi cư trú thực tế.",
    documents:
      "Với thủ tục tạm trú, bạn thường cần giấy tờ tùy thân, thông tin hoặc giấy tờ chứng minh chỗ ở hợp pháp, thông tin của chủ hộ/chủ nhà nếu nơi ở là nhà thuê, và biểu mẫu hoặc khai báo theo hướng dẫn của địa phương.",
    steps:
      "Các bước thường là: 1. Chuẩn bị giấy tờ tùy thân và giấy tờ về nơi ở hợp pháp. 2. Kê khai thông tin tạm trú trực tuyến hoặc tại nơi tiếp nhận. 3. Theo dõi trạng thái xử lý và bổ sung nếu cơ quan tiếp nhận yêu cầu. Nếu bạn ở trọ, nên trao đổi trước với chủ nhà để tránh thiếu thông tin về chỗ ở.",
    online:
      "Nếu nộp online, bạn nên chuẩn bị bản scan giấy tờ tùy thân và giấy tờ về chỗ ở hợp pháp để tải lên cổng dịch vụ công. Bạn cũng nên kiểm tra xem địa phương có yêu cầu xác nhận thêm từ chủ nhà hoặc chủ hộ hay không.",
    offline:
      "Nếu nộp trực tiếp, bạn mang giấy tờ tùy thân và tài liệu về chỗ ở đến cơ quan tiếp nhận theo hướng dẫn tại địa phương. Khi nộp, nên hỏi rõ tình trạng hồ sơ và thời gian trả kết quả để chủ động theo dõi.",
    authority:
      "Thủ tục tạm trú thường do cơ quan công an hoặc cơ quan quản lý cư trú tại địa phương tiếp nhận, tùy mô hình triển khai của nơi bạn cư trú.",
    timeline:
      "Thời gian xử lý tạm trú có thể khác nhau theo địa phương và tình trạng hồ sơ. Nếu hồ sơ thiếu giấy tờ về chỗ ở hoặc thông tin chủ nhà, thời gian xử lý thường dễ bị kéo dài hơn.",
    result:
      "Kết quả thường là thông tin tạm trú được cập nhật hợp lệ trong hệ thống cư trú hoặc giấy xác nhận theo mô hình xử lý tại địa phương.",
    condition:
      "Điều kiện quan trọng là bạn phải có nơi ở hợp pháp hoặc được phép cư trú hợp lệ tại địa chỉ đăng ký. Nếu là người thuê trọ, thông tin chỗ ở và sự phối hợp của chủ nhà thường rất quan trọng.",
    landlordSupport:
      "Nếu bạn thuê trọ, chủ nhà thường cần hỗ trợ phần thông tin về chỗ ở hợp pháp, xác nhận hoặc cung cấp giấy tờ liên quan đến địa chỉ cư trú theo yêu cầu của nơi tiếp nhận. Bạn nên hỏi trước xem địa phương có cần sự xác nhận của chủ nhà hoặc giấy tờ chứng minh chỗ ở do chủ nhà cung cấp hay không.",
    tips: [
      "Chuẩn bị đầy đủ giấy tờ về chỗ ở hợp pháp để tránh bị yêu cầu bổ sung.",
      "Nếu bạn thuê trọ, nên kiểm tra trước giấy tờ mà chủ nhà cần cung cấp.",
      "Nếu làm online, ảnh chụp giấy tờ nên rõ cả 4 góc và đúng thông tin địa chỉ."
    ],
    followUps: [
      "Đăng ký tạm trú cần giấy tờ gì?",
      "Tạm trú nộp ở đâu?",
      "Tạm trú online làm thế nào?",
      "Thuê trọ thì chủ nhà cần hỗ trợ gì?"
    ]
  },
  permanentResidence: {
    label: "đăng ký thường trú",
    aliases: ["thường trú", "đăng ký thường trú", "nhập hộ khẩu", "chuyển thường trú"],
    ask: "Bạn đang cần hỏi về điều kiện đăng ký thường trú, hồ sơ hay nơi nộp?",
    overview:
      "Đăng ký thường trú là thủ tục cư trú quan trọng, thường gắn với điều kiện về chỗ ở hợp pháp và quan hệ cư trú theo quy định. Khi làm thủ tục, người dân cần quan tâm cả điều kiện, hồ sơ chứng minh nơi ở và đúng cơ quan tiếp nhận.",
    documents:
      "Hồ sơ thường trú thường gồm giấy tờ tùy thân, giấy tờ chứng minh chỗ ở hợp pháp, thông tin cư trú liên quan và các tài liệu bổ sung theo trường hợp cụ thể như đồng ý của chủ hộ hoặc giấy tờ về quan hệ nhân thân nếu đăng ký theo hộ gia đình.",
    steps:
      "Bạn có thể thực hiện theo các bước: 1. Xác định xem mình có đủ điều kiện đăng ký thường trú hay không. 2. Chuẩn bị hồ sơ chứng minh chỗ ở hợp pháp và thông tin cư trú liên quan. 3. Nộp hồ sơ trực tiếp hoặc trực tuyến nếu địa phương hỗ trợ. 4. Theo dõi tình trạng xử lý và bổ sung giấy tờ nếu được yêu cầu.",
    authority:
      "Thủ tục thường trú thường do cơ quan công an hoặc cơ quan quản lý cư trú tiếp nhận theo nơi bạn đăng ký cư trú.",
    online:
      "Nếu nộp online, bạn nên chuẩn bị bản scan rõ nét của giấy tờ tùy thân và giấy tờ về chỗ ở hợp pháp, đồng thời kiểm tra xem địa phương có yêu cầu đối chiếu bản gốc sau đó hay không.",
    timeline:
      "Thời gian xử lý đăng ký thường trú thường phụ thuộc vào việc hồ sơ có đủ điều kiện và đủ tài liệu chứng minh chỗ ở hợp pháp hay không.",
    result:
      "Kết quả thường là thông tin thường trú được cập nhật trong hệ thống cư trú theo quy định hiện hành.",
    condition:
      "Điều kiện quan trọng nhất thường là có chỗ ở hợp pháp và đáp ứng tiêu chí đăng ký thường trú theo từng trường hợp cụ thể. Nếu chưa rõ điều kiện, bạn nên kiểm tra kỹ trường hợp của mình trước khi nộp hồ sơ.",
    tips: [
      "Nên kiểm tra trước giấy tờ chứng minh chỗ ở hợp pháp.",
      "Nếu đăng ký theo hộ gia đình, nên chuẩn bị thông tin chủ hộ và giấy tờ liên quan đầy đủ."
    ],
    followUps: [
      "Đăng ký thường trú cần điều kiện gì?",
      "Hồ sơ thường trú gồm gì?",
      "Thường trú nộp ở đâu?",
      "Đăng ký thường trú online được không?"
    ]
  },
  license: {
    label: "đổi/cấp lại giấy phép lái xe",
    aliases: ["gplx", "giấy phép lái", "lái xe", "đổi gplx", "cấp lại gplx", "bằng lái"],
    ask: "Bạn đang hỏi về cấp đổi hay cấp lại giấy phép lái xe?",
    overview:
      "Thủ tục giấy phép lái xe thường cần phân biệt rõ giữa cấp đổi và cấp lại, vì mỗi trường hợp có thành phần hồ sơ và yêu cầu kiểm tra khác nhau. Khi tra cứu, bạn nên nói rõ là sắp hết hạn, bị mất, bị hỏng hay muốn đổi sang mẫu mới.",
    documents:
      "Thường sẽ có nhóm giấy tờ như GPLX hiện có hoặc thông tin GPLX cũ, giấy tờ tùy thân, ảnh chân dung và trong một số trường hợp là giấy khám sức khỏe. Thành phần cụ thể có thể thay đổi theo loại GPLX và lý do cấp đổi/cấp lại.",
    steps:
      "Bạn nên xác định rõ là cấp đổi hay cấp lại, sau đó chuẩn bị hồ sơ, nộp tại kênh tiếp nhận phù hợp, theo dõi trạng thái xử lý và nhận kết quả theo giấy hẹn hoặc hệ thống trực tuyến.",
    online:
      "Nếu nộp online đổi GPLX, bạn nên chuẩn bị ảnh chân dung, giấy tờ tùy thân, thông tin GPLX và các giấy tờ được yêu cầu ở dạng số hóa rõ nét. Khi nộp, nên kiểm tra kỹ thông tin số GPLX, ngày cấp và hạng GPLX để tránh sai lệch.",
    offline:
      "Nếu nộp trực tiếp, bạn mang hồ sơ đến nơi tiếp nhận, kiểm tra lại thông tin cá nhân, loại GPLX và làm theo hướng dẫn tại quầy. Nếu có giấy khám sức khỏe, nên dùng bản còn hiệu lực theo yêu cầu.",
    authority:
      "Thủ tục GPLX thường do cơ quan giao thông hoặc đơn vị được ủy quyền tiếp nhận. Bạn nên kiểm tra cổng dịch vụ công hoặc nơi tiếp nhận tại địa phương.",
    timeline:
      "Thời gian xử lý đổi hoặc cấp lại GPLX tùy từng địa phương và loại thủ tục. Hồ sơ nộp trực tuyến cũng có thể cần thêm thời gian đối chiếu giấy tờ hoặc xác minh dữ liệu.",
    result:
      "Kết quả thường là GPLX được cấp đổi hoặc cấp lại hợp lệ theo thông tin đã được xác minh.",
    fees:
      "Lệ phí đổi hoặc cấp lại GPLX phụ thuộc từng loại thủ tục và từng nơi tiếp nhận. Bạn nên tra cứu biểu phí trên cổng dịch vụ công hoặc nơi xử lý hồ sơ.",
    compareVariant:
      "Cấp đổi GPLX thường áp dụng khi bằng sắp hết hạn, hư hỏng hoặc cần đổi thông tin theo quy định. Cấp lại thường hay gặp trong trường hợp bị mất hoặc không còn giữ bản cũ. Vì vậy hồ sơ đối chiếu, cách kiểm tra dữ liệu và yêu cầu chứng minh thông tin GPLX có thể khác nhau giữa hai trường hợp.",
    tips: [
      "Kiểm tra thời hạn GPLX hiện tại trước khi chọn thủ tục cấp đổi hay cấp lại.",
      "Ảnh chân dung và giấy tờ tải lên nên rõ, đủ sáng, không cắt mất góc.",
      "Nếu bị mất GPLX, bạn nên chuẩn bị thêm thông tin số GPLX cũ nếu còn nhớ."
    ],
    followUps: [
      "Đổi GPLX cần giấy tờ gì?",
      "Cấp lại GPLX khác gì cấp đổi?",
      "GPLX online nộp thế nào?",
      "Lệ phí đổi GPLX bao nhiêu?"
    ]
  },
  passport: {
    label: "cấp/đổi hộ chiếu",
    aliases: ["hộ chiếu", "passport", "xuất nhập cảnh", "cấp hộ chiếu", "đổi hộ chiếu"],
    ask: "Bạn đang cần hướng dẫn cấp mới hay cấp lại hộ chiếu?",
    overview:
      "Thủ tục hộ chiếu thường cần chú ý đúng loại hồ sơ là cấp mới, cấp lại do hết hạn, hay cấp lại do mất/hỏng. Người dân nên chuẩn bị ảnh đúng chuẩn, giấy tờ tùy thân và kiểm tra nơi tiếp nhận phù hợp trước khi nộp.",
    documents:
      "Bạn nên chuẩn bị ảnh đúng chuẩn, giấy tờ tùy thân, thông tin nhân thân đầy đủ và kiểm tra yêu cầu hồ sơ của cơ quan quản lý xuất nhập cảnh đối với trường hợp cụ thể của mình.",
    steps:
      "Các bước thường là chuẩn bị hồ sơ, chọn nơi tiếp nhận, kê khai thông tin chính xác, tải hoặc nộp giấy tờ theo hướng dẫn và theo dõi lịch hẹn hoặc trạng thái xử lý.",
    authority:
      "Hộ chiếu thường do cơ quan quản lý xuất nhập cảnh tiếp nhận và xử lý. Bạn nên kiểm tra đúng nơi tiếp nhận theo địa phương hoặc diện thủ tục của mình.",
    online:
      "Nếu nộp online, bạn nên chuẩn bị ảnh đúng chuẩn, giấy tờ tùy thân số hóa rõ nét và kiểm tra kỹ thông tin nhân thân trước khi gửi hồ sơ.",
    timeline:
      "Thời gian xử lý hộ chiếu phụ thuộc loại hồ sơ, nơi tiếp nhận và việc hồ sơ có đầy đủ, đúng chuẩn ngay từ đầu hay không.",
    result:
      "Kết quả thường là hộ chiếu mới hoặc hộ chiếu được cấp lại/cấp đổi theo hồ sơ đã xử lý.",
    reissueTips:
      "Nếu là cấp lại hộ chiếu, bạn nên kiểm tra kỹ lý do cấp lại như hết hạn, bị mất hay bị hỏng vì mỗi trường hợp có thể cần đối chiếu hoặc bổ sung tài liệu khác nhau. Ngoài ra, ảnh chân dung, thông tin nhân thân và nơi tiếp nhận phải được khai thật chính xác để tránh bị yêu cầu chỉnh sửa hồ sơ.",
    tips: [
      "Ảnh dùng cho hộ chiếu nên đúng chuẩn để tránh bị yêu cầu nộp lại.",
      "Kiểm tra kỹ thông tin nhân thân trước khi xác nhận hồ sơ.",
      "Nếu bị mất hộ chiếu, nên hỏi kỹ nơi tiếp nhận về tài liệu giải trình hoặc xác nhận cần bổ sung."
    ],
    followUps: [
      "Cấp hộ chiếu cần giấy tờ gì?",
      "Hộ chiếu nộp ở đâu?",
      "Hộ chiếu online làm sao?",
      "Cấp lại hộ chiếu có lưu ý gì?"
    ]
  },
  identity: {
    label: "cấp/cấp đổi/cấp lại CCCD",
    aliases: ["căn cước", "cccd", "thẻ căn cước", "chứng minh thư", "cmnd"],
    ask: "Bạn đang làm CCCD lần đầu, cấp đổi hay cấp lại?",
    overview:
      "Thủ tục CCCD/Căn cước thường chia thành cấp mới, cấp đổi và cấp lại. Mỗi trường hợp có yêu cầu chuẩn bị thông tin và tài liệu đối chiếu khác nhau, nên bạn càng nói rõ tình huống thì hướng dẫn càng sát hơn.",
    documents:
      "Với CCCD/Căn cước, bạn nên chuẩn bị giấy tờ tùy thân hiện có, thông tin cư trú và kiểm tra cơ quan công an nơi tiếp nhận. Nếu là cấp đổi hoặc cấp lại, nên chuẩn bị thêm giấy tờ hiện có hoặc thông tin liên quan để đối chiếu.",
    steps:
      "Bạn nên xác định đúng loại thủ tục trước, sau đó chuẩn bị giấy tờ theo trường hợp cấp mới, cấp đổi hoặc cấp lại, đến đúng nơi tiếp nhận, xác nhận thông tin và theo dõi thời gian trả kết quả.",
    authority:
      "CCCD/Căn cước thường do cơ quan công an có thẩm quyền tiếp nhận và xử lý theo nơi cư trú hoặc theo điểm tiếp nhận được bố trí.",
    timeline:
      "Thời gian xử lý CCCD/Căn cước khác nhau theo địa phương và từng đợt tiếp nhận. Bạn nên theo dõi giấy hẹn hoặc hướng dẫn tại nơi làm thủ tục.",
    result:
      "Kết quả thường là thẻ CCCD/Căn cước mới hoặc thông tin căn cước được cập nhật theo loại thủ tục bạn thực hiện.",
    compareVariant:
      "Cấp đổi CCCD thường áp dụng khi thẻ cũ hết hạn, thay đổi thông tin hoặc cần đổi sang mẫu mới. Cấp lại thường áp dụng khi bị mất, thất lạc hoặc không còn giữ thẻ cũ. Vì vậy thành phần hồ sơ và cách đối chiếu dữ liệu của hai trường hợp có thể khác nhau.",
    tips: [
      "Nếu là cấp đổi, bạn nên mang theo giấy tờ hiện có để đối chiếu.",
      "Nên kiểm tra trước nơi tiếp nhận để tránh đi sai điểm làm thủ tục.",
      "Khai thông tin nhân thân nên thật chính xác để tránh phải chỉnh sửa sau khi tiếp nhận."
    ],
    followUps: [
      "Làm CCCD cần giấy tờ gì?",
      "CCCD nộp ở đâu?",
      "CCCD mất bao lâu?",
      "Cấp lại CCCD khác gì cấp đổi?"
    ]
  },
  marriage: {
    label: "đăng ký kết hôn",
    aliases: ["kết hôn", "đăng ký kết hôn", "giấy kết hôn"],
    ask: "Bạn đang cần hỏi về hồ sơ đăng ký kết hôn, điều kiện hay nơi nộp?",
    overview:
      "Đăng ký kết hôn là thủ tục hộ tịch cần chú ý cả điều kiện kết hôn và thành phần hồ sơ. Nếu có yếu tố nước ngoài hoặc đăng ký ở nơi khác nơi cư trú, hồ sơ và thẩm quyền xử lý có thể khác so với trường hợp thông thường.",
    documents:
      "Hồ sơ đăng ký kết hôn thường gồm giấy tờ tùy thân, giấy tờ chứng minh tình trạng hôn nhân hoặc tài liệu liên quan theo trường hợp, cùng thông tin cư trú của hai bên. Nếu có yếu tố nước ngoài, thường cần kiểm tra kỹ thêm giấy tờ nhân thân và tài liệu hợp pháp hóa theo yêu cầu.",
    steps:
      "Bạn nên kiểm tra trước điều kiện kết hôn, chuẩn bị giấy tờ của cả hai bên, nộp tại cơ quan hộ tịch có thẩm quyền, đối chiếu thông tin nhân thân và theo dõi lịch trả kết quả hoặc thời gian xác minh nếu có.",
    authority:
      "Đăng ký kết hôn thường do cơ quan hộ tịch có thẩm quyền tiếp nhận, thường là UBND cấp xã đối với trường hợp trong nước thông thường.",
    timeline:
      "Thời gian xử lý đăng ký kết hôn có thể nhanh nếu hồ sơ đầy đủ và không cần xác minh thêm. Trường hợp có yếu tố nước ngoài hoặc giấy tờ phức tạp có thể mất thêm thời gian.",
    condition:
      "Bạn nên kiểm tra kỹ điều kiện kết hôn theo quy định trước khi chuẩn bị hồ sơ, nhất là tình trạng hôn nhân của mỗi bên và giấy tờ liên quan.",
    foreignElement:
      "Nếu kết hôn có yếu tố nước ngoài, hồ sơ và thẩm quyền giải quyết thường phức tạp hơn so với trường hợp trong nước thông thường. Bạn nên kiểm tra kỹ giấy tờ nhân thân, giấy tờ chứng minh tình trạng hôn nhân, khả năng phải hợp pháp hóa hoặc dịch thuật giấy tờ, và hỏi trước nơi tiếp nhận để được hướng dẫn đúng theo trường hợp cụ thể.",
    result:
      "Kết quả thường là giấy chứng nhận kết hôn hoặc thông tin hộ tịch được ghi nhận hợp lệ theo quy định.",
    tips: [
      "Hai bên nên kiểm tra thống nhất thông tin họ tên, ngày sinh, nơi cư trú trên giấy tờ trước khi nộp.",
      "Nếu có yếu tố nước ngoài, nên hỏi trước nơi tiếp nhận để chuẩn bị đúng giấy tờ."
    ],
    followUps: [
      "Đăng ký kết hôn cần giấy tờ gì?",
      "Điều kiện đăng ký kết hôn là gì?",
      "Đăng ký kết hôn nộp ở đâu?",
      "Kết hôn có yếu tố nước ngoài thì sao?"
    ]
  },
  maritalStatus: {
    label: "xác nhận tình trạng hôn nhân",
    aliases: ["tình trạng hôn nhân", "xác nhận tình trạng hôn nhân", "giấy độc thân", "xác nhận độc thân"],
    ask: "Bạn đang cần giấy xác nhận tình trạng hôn nhân để làm việc gì, ví dụ kết hôn hay giao dịch khác?",
    overview:
      "Giấy xác nhận tình trạng hôn nhân thường được dùng trong các giao dịch như đăng ký kết hôn hoặc một số thủ tục dân sự khác. Khi làm thủ tục, bạn nên xác định rõ mục đích sử dụng để chuẩn bị hồ sơ và nhận hướng dẫn phù hợp hơn.",
    documents:
      "Bạn thường cần giấy tờ tùy thân, thông tin cư trú và các tài liệu liên quan đến tình trạng hôn nhân hoặc nơi cư trú trước đây nếu cơ quan tiếp nhận cần đối chiếu.",
    steps:
      "Các bước thường là xác định mục đích sử dụng giấy xác nhận, chuẩn bị hồ sơ, nộp tại cơ quan hộ tịch có thẩm quyền, theo dõi xử lý và kiểm tra kỹ thông tin trên giấy xác nhận khi nhận kết quả.",
    authority:
      "Giấy xác nhận tình trạng hôn nhân thường do cơ quan hộ tịch nơi cư trú có thẩm quyền tiếp nhận và cấp.",
    timeline:
      "Thời gian xử lý phụ thuộc vào việc hồ sơ có đầy đủ và có cần xác minh tình trạng cư trú hoặc tình trạng hôn nhân trước đây hay không.",
    result:
      "Kết quả thường là giấy xác nhận tình trạng hôn nhân theo mục đích bạn khai trong hồ sơ.",
    tips: [
      "Nên ghi rõ mục đích sử dụng ngay từ đầu để tránh phải làm lại.",
      "Nếu từng cư trú ở nhiều nơi, nên chuẩn bị sẵn thông tin để đối chiếu nhanh hơn."
    ],
    followUps: [
      "Xác nhận tình trạng hôn nhân cần giấy tờ gì?",
      "Giấy độc thân nộp ở đâu?",
      "Giấy này dùng để kết hôn được không?",
      "Mất bao lâu để có kết quả?"
    ]
  }
};

function normalizeVietnameseChatText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bko\b|\bkhong\b/g, "không")
    .replace(/\bokela\b|\boki\b|\boke\b/g, "ok")
    .replace(/\bcccđ\b/g, "cccd")
    .trim();
}

function buildBulletList(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return items.map((item) => `- ${item}`).join("\n");
}

function getTopicEntries() {
  return Object.entries(TOPIC_KB);
}

function detectTopicFromKbText(text) {
  const t = normalizeVietnameseChatText(text);
  let bestMatch = "";
  let bestScore = 0;
  for (const [topicKey, kb] of getTopicEntries()) {
    const aliases = Array.isArray(kb.aliases) ? kb.aliases : [];
    for (const alias of aliases) {
      const normalizedAlias = normalizeVietnameseChatText(alias);
      if (!normalizedAlias || !t.includes(normalizedAlias)) continue;
      const score = normalizedAlias.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = topicKey;
      }
    }
  }
  return bestMatch;
}

function dedupeItems(items = []) {
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const value = String(item || "").trim();
    const key = normalizeVietnameseChatText(value);
    if (!value || seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function getLastAssistantReply(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === "assistant" && typeof list[i]?.content === "string") {
      return list[i].content;
    }
  }
  return "";
}

// ─── FIX: emit "new-message" đến từng user_${memberId} ───────────────────────
// Vấn đề cũ: emit vào `chat_${roomId}` nhưng frontend không join room đó.
// Frontend chỉ join `user_${userId}` khi connect socket.
// Fix: lấy members của room → emit đến `user_${memberId}` từng người.
// Event name phải là "new-message" để khớp với ChatPage.jsx socket listener.
async function emitToRoomMembers(room, payload) {
  try {
    const io = getIo();
    const members = room?.members || [];
    members.forEach((m) => {
      const memberId = typeof m === "object" ? m.id : m;
      if (!memberId) return;
      io.to(`user_${memberId}`).emit("new-message", payload);
      console.log(`[SOCKET] 📤 new-message → user_${memberId}`);
    });
  } catch (e) {
    console.warn("[Socket] Không thể emit new-message:", e.message);
  }
}

// ─── Staff chat ───────────────────────────────────────────────────────────────
exports.staffHistory = async (req, res) => {
  try {
    const conversation = await getChatHistory(req.user.id);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi đọc hội thoại" });
  }
};

exports.staffSend = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "Nội dung không được trống" });
    if (text.length > 2000) return res.status(400).json({ message: "Tối đa 2000 ký tự" });

    const conversationId = req.user.id;
    const userData = await userStore.findById(req.user.id);
    const fullName = userData?.fullName || "Người dùng";
    const avatarUrl =
      userData?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`;
    const sender = { id: req.user.id, fullName, avatarUrl };

    await sendMessage({ userId: conversationId, from: "user", text, sender });

    const conversation = await getChatHistory(conversationId);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];

    try {
      const io = getIo();
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        io.to("admin").emit("supportConversationMessage", {
          userId: conversationId,
          message: lastMessage,
        });
      }
    } catch (socketError) {
      console.warn("[Socket] supportConversationMessage:", socketError.message);
    }

    res.json({ ok: true, messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi gửi tin" });
  }
};

function detectFallbackTopic(text) {
  const t = normalizeVietnameseChatText(text);
  const detectedByKb = detectTopicFromKbText(t);
  if (detectedByKb) return detectedByKb;
  if (/lệ phí|phí|bao nhiêu tiền/.test(t)) return "fees";
  if (/thời gian|giờ làm|mấy giờ/.test(t)) return "hours";
  return "";
}

function detectFollowUpIntent(text) {
  const t = normalizeVietnameseChatText(text);
  if (/hướng dẫn đúng hơn|nói rõ hơn|chi tiết hơn|cụ thể hơn|hướng dẫn tiếp|giải thích thêm/.test(t)) {
    return "detail";
  }
  if (/cần giấy tờ gì|hồ sơ gồm gì|chuẩn bị gì/.test(t)) {
    return "documents";
  }
  if (/thủ tục thế nào|các bước|quy trình/.test(t)) {
    return "steps";
  }
  if (/khác gì|khác nhau thế nào|phân biệt|so với/.test(t)) {
    return "compareVariant";
  }
  if (/điều kiện gì|điều kiện là gì|cần điều kiện gì|có đủ điều kiện/.test(t)) {
    return "condition";
  }
  if (/chủ nhà cần|chủ trọ cần|chủ nhà hỗ trợ|thuê trọ.*hỗ trợ/.test(t)) {
    return "landlordSupport";
  }
  if (/kết quả là gì|nhận được gì|trả ra gì|ra kết quả gì/.test(t)) {
    return "result";
  }
  if (/dùng để|sử dụng để|dùng cho việc gì|để làm gì/.test(t)) {
    return "result";
  }
  if (/đăng ký lại|làm lại/.test(t)) {
    return "reissue";
  }
  if (/đúng hạn/.test(t)) {
    return "ontime";
  }
  if (/nộp online|trực tuyến|online/.test(t)) {
    return "online";
  }
  if (/nộp trực tiếp|đến trực tiếp|trực tiếp/.test(t)) {
    return "offline";
  }
  if (/ở đâu|nơi nào|cơ quan nào|ubnd nào|nộp ở đâu/.test(t)) {
    return "authority";
  }
  if (/lưu ý|cần chú ý|cần lưu ý|mẹo/.test(t)) {
    return "tips";
  }
  if (/bao lâu|mất bao lâu|thời hạn|mấy ngày/.test(t)) {
    return "timeline";
  }
  if (/lệ phí|phí|bao nhiêu tiền|mất bao nhiêu tiền/.test(t)) {
    return "fees";
  }
  if (/đúng rồi|đúng vậy|phải|vâng|ừ|ok|oke/.test(t)) {
    return "confirm_yes";
  }
  if (/không phải|không|chưa|sai rồi/.test(t)) {
    return "confirm_no";
  }
  return "";
}

function isShortFollowUpAnswer(text) {
  const t = normalizeVietnameseChatText(text);
  if (!t) return false;
  if (t.length <= 30) return true;
  return /^(đúng hạn|đăng ký lại|nộp online|online|trực tiếp|cần giấy tờ gì|các bước|hướng dẫn tiếp)$/i.test(t);
}

function inferTopicFromAssistantPrompt(text) {
  return detectTopicFromKbText(text);
}

function inferPendingQuestion(text) {
  const t = normalizeVietnameseChatText(text);
  if (/đúng hạn|đăng ký lại/.test(t)) return "birth_branch";
  if (/cấp mới|cấp lại|cấp đổi/.test(t)) return "variant_branch";
  if (/online|trực tuyến|trực tiếp/.test(t)) return "channel_branch";

  const matches = [];
  if (/hồ sơ|giấy tờ|chuẩn bị/.test(t)) matches.push("documents");
  if (/các bước|quy trình|thủ tục/.test(t)) matches.push("steps");
  if (/ở đâu|cơ quan nào|ubnd/.test(t)) matches.push("authority");
  if (/điều kiện/.test(t)) matches.push("condition");
  if (/bao lâu|thời gian/.test(t)) matches.push("timeline");
  if (/kết quả|nhận được gì/.test(t)) matches.push("result");

  if (matches.length === 1) return matches[0];
  return "";
}

function findTopicFromMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const content = String(list[i]?.content || "");
    const topic = detectFallbackTopic(content);
    if (topic) return topic;
  }
  return "";
}

function findLastAssistantMessage(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === "assistant" && typeof list[i]?.content === "string") {
      return list[i].content;
    }
  }
  return "";
}

function buildConversationState(messages, userText) {
  const lastAssistantMessage = findLastAssistantMessage(messages.slice(0, -1));
  const assistantTopic = inferTopicFromAssistantPrompt(lastAssistantMessage);
  const previousTopic = findTopicFromMessages(messages.slice(0, -1));
  const currentTopic = detectFallbackTopic(userText);
  const followUpIntent = detectFollowUpIntent(userText);
  const pendingQuestion = inferPendingQuestion(lastAssistantMessage);
  let topic = currentTopic || assistantTopic || previousTopic;

  if (
    followUpIntent &&
    previousTopic &&
    topic &&
    topic !== previousTopic &&
    normalizeVietnameseChatText(userText).length <= 60
  ) {
    topic = previousTopic;
  }

  return {
    topic,
    followUpIntent,
    pendingQuestion,
    lastAssistantMessage
  };
}

function replyForExactFollowUp(topic, userText) {
  const t = normalizeVietnameseChatText(userText);
  if (!topic || !t) return "";

  const followUpReplyMap = {
    birth: [
      [/đúng hạn.*giấy tờ|khai sinh đúng hạn.*giấy tờ/, "documents"],
      [/đăng ký lại.*khác gì|khác gì.*đúng hạn/, "compareVariant"],
      [/khai sinh.*online|nộp khai sinh online/, "online"],
      [/khai sinh.*ở đâu|khai sinh nộp ở đâu/, "authority"]
    ],
    residence: [
      [/tạm trú.*giấy tờ|đăng ký tạm trú.*giấy tờ/, "documents"],
      [/tạm trú.*ở đâu|tạm trú nộp ở đâu/, "authority"],
      [/tạm trú.*online/, "online"],
      [/thuê trọ.*chủ nhà|chủ nhà.*hỗ trợ|chủ trọ.*hỗ trợ/, "landlordSupport"]
    ],
    permanentResidence: [
      [/thường trú.*điều kiện/, "condition"],
      [/hồ sơ thường trú|thường trú.*gồm gì/, "documents"],
      [/thường trú.*ở đâu|thường trú nộp ở đâu/, "authority"],
      [/thường trú.*online/, "online"]
    ],
    license: [
      [/gplx.*giấy tờ|đổi gplx.*giấy tờ/, "documents"],
      [/cấp lại gplx.*khác gì|khác gì.*cấp đổi/, "compareVariant"],
      [/gplx.*online/, "online"],
      [/lệ phí.*gplx|phí.*gplx/, "fees"]
    ],
    passport: [
      [/hộ chiếu.*giấy tờ|cấp hộ chiếu.*giấy tờ/, "documents"],
      [/hộ chiếu.*ở đâu|hộ chiếu nộp ở đâu/, "authority"],
      [/hộ chiếu.*online/, "online"],
      [/cấp lại hộ chiếu.*lưu ý/, "reissueTips"]
    ],
    identity: [
      [/cccd.*giấy tờ|làm cccd.*giấy tờ/, "documents"],
      [/cccd.*ở đâu|cccd nộp ở đâu/, "authority"],
      [/cccd.*bao lâu|cccd mất bao lâu/, "timeline"],
      [/cấp lại cccd.*khác gì|khác gì.*cấp đổi/, "compareVariant"]
    ],
    marriage: [
      [/kết hôn.*giấy tờ/, "documents"],
      [/điều kiện.*kết hôn|kết hôn.*điều kiện/, "condition"],
      [/kết hôn.*ở đâu|kết hôn nộp ở đâu/, "authority"],
      [/kết hôn.*yếu tố nước ngoài/, "foreignElement"]
    ],
    maritalStatus: [
      [/tình trạng hôn nhân.*giấy tờ|giấy độc thân.*giấy tờ/, "documents"],
      [/giấy độc thân.*ở đâu|tình trạng hôn nhân.*ở đâu/, "authority"],
      [/dùng để kết hôn|sử dụng.*kết hôn/, "result"],
      [/bao lâu.*kết quả|mất bao lâu.*kết quả/, "timeline"]
    ]
  };

  const mappings = followUpReplyMap[topic] || [];
  for (const [pattern, intent] of mappings) {
    if (pattern.test(t)) {
      return replyForTopic(topic, intent);
    }
  }
  return "";
}

function replyForTopic(topic, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return "";
  if (!intent) {
    return kb.overview || kb.ask || kb.documents || "";
  }
  if (intent === "detail") {
    return kb.steps || kb.documents || kb.overview || kb.ask || "";
  }
  if (intent === "tips") {
    return kb.tips?.length
      ? `Một số lưu ý khi làm ${kb.label}:\n${buildBulletList(kb.tips)}`
      : kb.documents || kb.overview || kb.ask || "";
  }
  if (intent === "fees") {
    return kb.fees || `Lệ phí của ${kb.label} có thể thay đổi theo địa phương và loại hồ sơ. Bạn nên kiểm tra biểu phí tại nơi tiếp nhận hoặc trên cổng dịch vụ công để biết chính xác.`;
  }
  if (intent === "timeline") {
    return kb.timeline || `Thời hạn xử lý của ${kb.label} có thể khác theo từng địa phương và từng trường hợp hồ sơ. Bạn nên kiểm tra thông báo tại nơi tiếp nhận hoặc trên cổng dịch vụ công sau khi nộp hồ sơ để biết mốc thời gian chính xác.`;
  }
  if (intent === "result") {
    return kb.result || `Kết quả xử lý của ${kb.label} phụ thuộc loại hồ sơ và cách tiếp nhận, nhưng bạn nên kiểm tra kỹ thông tin trên giấy tờ hoặc kết quả trả về khi nhận hồ sơ.`;
  }
  if (intent === "compareVariant") {
    return kb.compareVariant || kb.reissue || kb.ontime || kb.overview || "";
  }
  if (intent === "condition") {
    return kb.condition || `Điều kiện thực hiện ${kb.label} có thể khác theo từng trường hợp cụ thể. Bạn nên nói rõ tình huống của mình để tôi hướng dẫn sát hơn.`;
  }
  if (intent === "landlordSupport") {
    return kb.landlordSupport || kb.condition || kb.documents || kb.overview || "";
  }
  if (intent === "reissueTips") {
    if (kb.reissueTips) return kb.reissueTips;
    if (kb.tips?.length) return `Một số lưu ý khi làm ${kb.label}:\n${buildBulletList(kb.tips)}`;
    return kb.overview || "";
  }
  if (intent === "foreignElement") {
    return kb.foreignElement || kb.condition || kb.documents || kb.overview || "";
  }
  return kb[intent] || kb.overview || kb.ask || "";
}

function composeSmartReply(topic, primaryAnswer, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return primaryAnswer;
  const structured = buildStructuredReply(topic, "", intent, primaryAnswer);
  if (!structured) return primaryAnswer;
  return structured;
}

function buildAiSuggestions(topic, intent = "") {
  const generic = [
    "Cần giấy tờ gì?",
    "Các bước thực hiện thế nào?",
    "Nộp ở đâu?",
    "Có lưu ý gì quan trọng?"
  ];

  const suggestions = dedupeItems(TOPIC_KB[topic]?.followUps || generic);
  if (!intent) return suggestions.slice(0, 4);

  return suggestions
    .filter((item) => {
      const normalized = normalizeVietnameseChatText(item);
      if (intent === "documents") return !normalized.includes("giấy tờ") && !normalized.includes("hồ sơ");
      if (intent === "steps") return !normalized.includes("bước") && !normalized.includes("thế nào");
      if (intent === "authority") return !normalized.includes("ở đâu");
      if (intent === "tips") return !normalized.includes("lưu ý");
      if (intent === "timeline") return !normalized.includes("bao lâu") && !normalized.includes("thời gian");
      if (intent === "fees") return !normalized.includes("lệ phí") && !normalized.includes("phí");
      if (intent === "condition") return !normalized.includes("điều kiện");
      if (intent === "landlordSupport") return !normalized.includes("chủ nhà") && !normalized.includes("chủ trọ");
      if (intent === "result") return !normalized.includes("kết quả");
      if (intent === "compareVariant") return !normalized.includes("khác gì") && !normalized.includes("phân biệt");
      return true;
    })
    .slice(0, 4);
}

function buildAlternativeReply(topic, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return "";
  const alternatives = [
    kb.documents,
    kb.steps,
    kb.authority,
    kb.timeline,
    kb.result,
    kb.condition,
    kb.online,
    kb.offline,
    kb.ask
  ];
  if (intent === "documents") alternatives.unshift(kb.steps, kb.authority);
  if (intent === "steps") alternatives.unshift(kb.documents, kb.authority);
  return alternatives.find(Boolean) || "";
}

function getNoDataReply() {
  return "Dữ liệu hiện tại của tôi chưa cập nhật đủ chi tiết cho trường hợp này, vui lòng liên hệ Bộ phận 1 cửa để được hỗ trợ chính xác nhất.";
}

function buildStructuredReply(topic, userText, intent, primaryAnswer) {
  const kb = TOPIC_KB[topic];
  if (!kb || !primaryAnswer) return primaryAnswer || getNoDataReply();

  const authorityText =
    kb.authority
      ? `${kb.authority}${kb.online ? ` Nếu địa phương hỗ trợ, bạn có thể ưu tiên nộp online qua Cổng dịch vụ công/VNeID; nếu không thì nộp trực tiếp theo hướng dẫn.` : " Bạn nên kiểm tra nơi tiếp nhận trực tiếp tại địa phương nếu chưa có kênh trực tuyến phù hợp."}`
      : "Bạn nên kiểm tra cơ quan có thẩm quyền trên Cổng dịch vụ công hoặc liên hệ Bộ phận 1 cửa tại địa phương.";

  const guidanceItems = [];

  if (kb.documents) guidanceItems.push(`- Hồ sơ cần chuẩn bị: ${kb.documents}`);
  if (kb.steps) guidanceItems.push(`- Trình tự các bước thực hiện: ${kb.steps}`);
  guidanceItems.push(`- Cơ quan có thẩm quyền giải quyết: ${authorityText}`);

  const specialNote =
    kb.tips?.length
      ? `Lưu ý đặc biệt: ${kb.tips.join(" ")}`
      : "Lưu ý đặc biệt: Bạn nên kiểm tra kỹ thông tin cá nhân, giấy tờ gốc và hướng dẫn riêng của địa phương trước khi nộp hồ sơ.";

  return [
    `Xác nhận trường hợp: Bạn đang hỏi về ${kb.label}${userText ? ` với nội dung "${userText.trim()}".` : "."}`,
    `Quy định chung: ${primaryAnswer}`,
    "Hướng dẫn cụ thể:",
    ...guidanceItems,
    specialNote
  ].join("\n");
}

function preventDuplicateReply(messages, reply, topic, intent) {
  const lastAssistantReply = getLastAssistantReply(messages);
  if (!lastAssistantReply) return reply;

  const normalizedReply = normalizeVietnameseChatText(reply);
  const normalizedLast = normalizeVietnameseChatText(lastAssistantReply);

  if (normalizedReply && normalizedReply === normalizedLast) {
    const alternative = buildAlternativeReply(topic, intent);
    if (alternative && normalizeVietnameseChatText(alternative) !== normalizedLast) {
      return composeSmartReply(topic, alternative, intent);
    }
    return `${reply}\n\nNếu bạn muốn, hãy nói rõ bạn đang cần phần hồ sơ, các bước, nơi nộp, thời gian hay lệ phí để tôi trả lời đúng trọng tâm hơn.`;
  }

  return reply;
}

function replyForPendingQuestion(topic, pendingQuestion, userText, intent) {
  if (!topic) return "";
  if (pendingQuestion === "birth_branch") {
    if (intent === "ontime") return replyForTopic(topic, "ontime");
    if (intent === "reissue") return replyForTopic(topic, "reissue");
  }
  if (pendingQuestion === "channel_branch") {
    if (intent === "online") return replyForTopic(topic, "online");
    if (intent === "offline") return replyForTopic(topic, "offline");
  }
  if (pendingQuestion === "documents" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "documents");
  }
  if (pendingQuestion === "steps" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "steps");
  }
  if (pendingQuestion === "condition" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "condition");
  }
  if (pendingQuestion === "result" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "result");
  }
  return "";
}

function buildConversationSummary(messages, userText) {
  const state = buildConversationState(messages, userText);
  const recentUserMessages = messages
    .filter((message) => message?.role === "user" && typeof message?.content === "string")
    .slice(-3)
    .map((message) => `- ${message.content}`)
    .join("\n");

  return [
    state.topic ? `Chủ đề hiện tại suy ra: ${state.topic}` : "Chưa suy ra rõ chủ đề hiện tại",
    state.followUpIntent ? `Ý định gần nhất của người dùng: ${state.followUpIntent}` : "Ý định gần nhất chưa rõ",
    state.pendingQuestion ? `Câu hỏi nhánh gần nhất của trợ lý: ${state.pendingQuestion}` : "Không có câu hỏi nhánh đang chờ",
    state.lastAssistantMessage ? `Tin nhắn gần nhất của trợ lý: ${state.lastAssistantMessage}` : "Chưa có tin nhắn trợ lý gần trước đó",
    recentUserMessages ? `Ba tin nhắn người dùng gần nhất:\n${recentUserMessages}` : "Chưa có đủ lịch sử người dùng"
  ].join("\n");
}

function fallbackAiReply(userText, messages = []) {
  const t = normalizeVietnameseChatText(userText);
  const state = buildConversationState(messages, userText);
  const { topic, followUpIntent, pendingQuestion } = state;

  const exactFollowUpReply = replyForExactFollowUp(topic, userText);
  if (exactFollowUpReply) {
    return preventDuplicateReply(messages, composeSmartReply(topic, exactFollowUpReply, followUpIntent), topic, followUpIntent);
  }

  if (topic === "maritalStatus" && /kết hôn/.test(t) && /dùng để|sử dụng/.test(t)) {
    return "Giấy xác nhận tình trạng hôn nhân thường có thể dùng để đăng ký kết hôn nếu mục đích sử dụng được khai đúng trong hồ sơ và giấy còn giá trị theo yêu cầu của nơi tiếp nhận. Khi nộp, bạn nên kiểm tra kỹ mục đích ghi trên giấy và thời hạn sử dụng thực tế theo hướng dẫn của cơ quan hộ tịch.";
  }

  const pendingReply = replyForPendingQuestion(topic, pendingQuestion, userText, followUpIntent);
  if (pendingReply) return preventDuplicateReply(messages, composeSmartReply(topic, pendingReply, followUpIntent), topic, followUpIntent);

  if (topic && isShortFollowUpAnswer(userText) && followUpIntent) {
    const intentReply = replyForTopic(topic, followUpIntent);
    if (intentReply) return preventDuplicateReply(messages, composeSmartReply(topic, intentReply, followUpIntent), topic, followUpIntent);
  }

  if (topic && followUpIntent) {
    const followUpReply = replyForTopic(topic, followUpIntent);
    if (followUpReply) return preventDuplicateReply(messages, composeSmartReply(topic, followUpReply, followUpIntent), topic, followUpIntent);
  }

  if (/chào|xin chào|hello|hi\b/.test(t)) {
    return "Xin chào! Tôi là trợ lý AI hỗ trợ thủ tục hành chính trên Cổng dịch vụ công. Bạn cần tra cứu thủ tục, biểu mẫu hay hướng dẫn nộp hồ sơ?";
  }
  if (/căn cước|cccd|chứng minh thư/.test(t)) {
    return "Với thủ tục liên quan CCCD/Căn cước, bạn nên chuẩn bị giấy tờ tùy thân hiện có, thông tin cư trú và kiểm tra cơ quan công an nơi tiếp nhận. Nếu bạn nói rõ là cấp mới, cấp đổi hay cấp lại, tôi sẽ hướng dẫn sát hơn.";
  }
  if (/khai sinh|hộ tịch|giấy khai sinh/.test(t)) {
    return "Đăng ký khai sinh thường cần thông tin cha mẹ, giấy chứng sinh hoặc giấy tờ thay thế, cùng giấy tờ tùy thân của người đi đăng ký. Bạn cho tôi biết là đăng ký đúng hạn hay đăng ký lại để tôi hướng dẫn đúng hơn.";
  }
  if (/tạm trú|đăng ký cư trú/.test(t)) {
    return "Về tạm trú: thường cần CMND/CCCD, giấy tờ chỗ ở, phiếu báo tạm vắng (nếu có). Bạn nên chọn đúng cấp tiếp nhận (xã/phường) trên cổng và điền form trực tuyến.";
  if (/gplx|lái xe|giấy phép lái/.test(t))
    return "Đổi GPLX: chuẩn bị ảnh, giấy khám sức khỏe, GPLX cũ và làm theo hướng dẫn trên CSDL giao thông / cổng dịch vụ công — có thể nộp trực tuyến tùy địa phương.";
  if (/hộ chiếu|passport/.test(t))
    return "Cấp/đổi hộ chiếu: kiểm tra ảnh, CMND/CCCD, lịch hẹn (nếu có). Nhiều bước đã được điện tử hóa — xem mục Hộ chiếu trên cổng.";
  }
  if (/thời gian|giờ làm|mấy giờ/.test(t)) {
    return "Thông thường bộ phận một cửa làm việc giờ hành chính (sáng 7h30–11h30, chiều 13h30–17h00), có thể khác theo địa phương.";
  }
  if (/lệ phí|phí|bao nhiêu tiền/.test(t)) {
    return "Lệ phí phụ thuộc từng thủ tục và từng địa phương. Bạn hãy cho tôi biết tên thủ tục và nơi nộp hồ sơ để tôi hướng dẫn cách kiểm tra chính xác hơn trên cổng hoặc tại cơ quan tiếp nhận.";
  }
  if (topic) {
    const topicReply = replyForTopic(topic, "");
    if (topicReply) return preventDuplicateReply(messages, composeSmartReply(topic, topicReply, ""), topic, "");
  }

  return getNoDataReply();
}

function buildKnowledgeSnippets(userText) {
  const t = normalizeVietnameseChatText(userText);
  const snippets = [];

  if (/tạm trú|đăng ký cư trú|lưu trú/.test(t)) {
    snippets.push(
      "Chủ đề cư trú/tạm trú: ưu tiên hướng dẫn theo nhóm thông tin gồm giấy tờ tùy thân, giấy tờ chỗ ở hợp pháp, bước kê khai trực tuyến và lưu ý xác nhận tại công an/cơ quan cư trú địa phương."
    );
  }
  if (/gplx|giấy phép lái|lái xe/.test(t)) {
    snippets.push(
      "Chủ đề GPLX: nêu rõ khác biệt giữa cấp đổi, cấp lại, đổi do sắp hết hạn; nhắc kiểm tra ảnh chân dung, giấy khám sức khỏe và kênh nộp hồ sơ trực tuyến của địa phương."
    );
  }
  if (/hộ chiếu|passport|xuất nhập cảnh/.test(t)) {
    snippets.push(
      "Chủ đề hộ chiếu: gợi ý người dùng chuẩn bị ảnh đúng chuẩn, CCCD/căn cước, thông tin nhân thân và kiểm tra nơi tiếp nhận hồ sơ thuộc cơ quan quản lý xuất nhập cảnh."
    );
  }
  if (/khai sinh|hộ tịch|kết hôn|khai tử/.test(t)) {
    snippets.push(
      "Chủ đề hộ tịch: trả lời theo cấu trúc giấy tờ cần có, đối tượng đi nộp, nơi đăng ký, thời hạn xử lý và trường hợp phải đối chiếu bản gốc."
    );
  }
  if (/thường trú|nhập hộ khẩu|chuyển thường trú/.test(t)) {
    snippets.push(
      "Chủ đề thường trú: ưu tiên làm rõ điều kiện đăng ký, giấy tờ chứng minh chỗ ở hợp pháp, cơ quan tiếp nhận và khả năng nộp online."
    );
  }
  if (/tình trạng hôn nhân|giấy độc thân|xác nhận độc thân/.test(t)) {
    snippets.push(
      "Chủ đề xác nhận tình trạng hôn nhân: hỏi rõ mục đích sử dụng, nơi cư trú và tài liệu cần đối chiếu tình trạng hôn nhân trước đây."
    );
  }
  if (/đất đai|sổ đỏ|quyền sử dụng đất/.test(t)) {
    snippets.push(
      "Chủ đề đất đai: nhấn mạnh hồ sơ thường nhiều biến thể theo loại thủ tục, cần hỏi thêm địa phương và loại biến động trước khi kết luận."
    );
  }

  return snippets;
}

function buildSystemPrompt(rulesText, conversationSummary, snippets = []) {
  const knowledgeBlock = snippets.length
    ? `\nNgữ cảnh chủ đề liên quan:\n- ${snippets.join("\n- ")}`
    : "";

  return `Bạn là Trợ lý Ảo Hành chính Công của Cổng Dịch vụ công Việt Nam.

Mục tiêu:
- Hỗ trợ người dân tra cứu thủ tục hành chính, giấy tờ, quy trình và lưu ý thực hiện.
- Trả lời mạch lạc, chuẩn mực, khách quan, dễ hiểu.
- Tuyệt đối không bịa thông tin pháp lý hoặc cam kết kết quả xử lý hồ sơ.
- Chỉ dựa trên dữ liệu đã có trong hội thoại, quy tắc admin và ngữ cảnh tri thức được cung cấp.${knowledgeBlock}

Quy tắc trả lời hiện hành do admin cấu hình:
${rulesText}

Tóm tắt hội thoại hiện có:
${conversationSummary}

Cách xử lý bắt buộc:
- Bước 1: Phân loại và bóc tách vấn đề. Xác định lĩnh vực thủ tục hành chính đang được hỏi.
- Bước 2: Chỉ dựa trên dữ liệu được cung cấp để trả lời. Nếu dữ liệu không đủ chắc chắn, phải trả lời đúng câu: "Dữ liệu hiện tại của tôi chưa cập nhật đủ chi tiết cho trường hợp này, vui lòng liên hệ Bộ phận 1 cửa để được hỗ trợ chính xác nhất."
- Bước 3: Trình bày theo cấu trúc:
  Xác nhận trường hợp
  Quy định chung
  Hướng dẫn cụ thể
  Hồ sơ cần chuẩn bị
  Trình tự các bước thực hiện
  Cơ quan có thẩm quyền giải quyết
  Lưu ý đặc biệt

Yêu cầu diễn đạt:
- Luôn trả lời bằng tiếng Việt.
- Ưu tiên câu ngắn, rõ, chuẩn mực, không dùng từ lóng.
- Nếu câu hỏi chưa đủ dữ kiện, hỏi lại tối đa 1-2 ý quan trọng nhất.
- Nếu người dùng đang trả lời cho câu hỏi phân nhánh trước đó của trợ lý, hãy nối tiếp đúng nhánh thay vì hỏi lại từ đầu.
- Nếu có rủi ro sai khác theo địa phương/quy định mới, nói rõ đây là thông tin tham khảo và khuyên xác nhận tại cơ quan có thẩm quyền.
- Không dùng emoji.
- Nếu ngoài phạm vi thủ tục hành chính, lịch sự từ chối và hướng sang kênh hỗ trợ phù hợp.`;
}

async function openAiChat(messages, rulesText, userText) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const snippets = buildKnowledgeSnippets(userText);
  const conversationSummary = buildConversationSummary(messages, userText);
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(rulesText, conversationSummary, snippets)
      },
      ...messages,
    ],
    max_tokens: 900,
    temperature: 0.4,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(errText.slice(0, 300) || `OpenAI HTTP ${r.status}`);
  }

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : null;
}

exports.aiChat = async (req, res) => {
  try {
    const raw = req.body?.message;
    const history = req.body?.messages;
    const sessionId = String(req.body?.sessionId || "").trim() || `guest-${Date.now()}`;

    let userText = "";
    if (typeof raw === "string") {
      userText = raw.trim();
    } else if (Array.isArray(history) && history.length) {
      const last = history[history.length - 1];
      if (last?.role === "user" && typeof last.content === "string") {
        userText = last.content.trim();
      }
    }

    if (!userText) return res.status(400).json({ message: "Vui lòng nhập nội dung câu hỏi." });
    if (userText.length > 4000) return res.status(400).json({ message: "Nội dung quá dài." });

    const msgs = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [{ role: "user", content: userText }];

    const rulesText = await getAiRules().catch(() => "");
    const state = buildConversationState(msgs, userText);
    let reply = null;
    let mode = process.env.OPENAI_API_KEY ? "openai" : "fallback";
    try {
      reply = await openAiChat(msgs, rulesText, userText);
    } catch (e) {
      console.error("OpenAI error:", e.message);
      mode = "fallback";
    }

    if (!reply) {
      reply = fallbackAiReply(userText, msgs);
      mode = "fallback";
    }

    const detectedTopic = state.topic || detectFallbackTopic(reply) || "";
    const suggestions = buildAiSuggestions(detectedTopic, state.followUpIntent);

    const actorName =
      req.user?.fullName ||
      req.user?.name ||
      req.user?.email ||
      req.body?.visitorName ||
      "Khách";

    await appendAiHistory({
      sessionId,
      question: userText,
      answer: reply,
      source: "home_chat",
      mode,
      userId: req.user?.id || "",
      userName: actorName,
      turnIndex: msgs.filter((message) => message.role === "user").length,
      confidenceLabel: mode === "openai" ? "assisted" : "fallback",
      note: mode === "fallback" ? "Tra loi bang bo quy tac noi bo/fallback" : "Tra loi bang mo hinh AI",
      meta: {
        turns: msgs.length,
        detectedTopic,
        suggestions,
        hasAuthenticatedUser: Boolean(req.user?.id),
        ip:
          req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "",
        userAgent: req.headers["user-agent"] || ""
      }
    }).catch((error) => {
      console.error("appendAiHistory error:", error.message);
    });

    res.json({
      reply,
      mode,
      sessionId,
      detectedTopic,
      suggestions
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi trợ lý AI" });
  }
};

// ─── Room/Contact queries ─────────────────────────────────────────────────────
exports.chatContacts = async (req, res) => {
  try {
    const q = req.query?.q || "";
    const contacts = await multiChatStore.searchContacts({ keyword: q, currentUserId: req.user.id });
    return res.json({ contacts });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải danh bạ" });
  }
};

exports.friendDiscovery = async (req, res) => {
  try {
    const q = req.query?.q || "";
    const users = await userStore.searchUsersForFriendAdd(req.user.id, q);
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tìm người dùng" });
  }
};

exports.friendSuggestions = async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 5);
    const users = await userStore.listSuggestedFriends(req.user.id, limit);
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải gợi ý kết bạn" });
  }
};

exports.friendRequests = async (req, res) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      userStore.listIncomingFriendRequests(req.user.id),
      userStore.listOutgoingFriendRequests(req.user.id)
    ]);
    return res.json({
      requests: incoming,
      incoming,
      outgoing,
      counts: {
        incoming: incoming.length,
        outgoing: outgoing.length
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải lời mời kết bạn" });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    const targetUserId = String(req.body?.targetUserId || "").trim();
    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu người dùng cần kết bạn" });
    }
    const result = await userStore.sendFriendRequest(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gửi lời mời kết bạn" });
  }
};

exports.respondFriendRequest = async (req, res) => {
  try {
    const requesterId = String(req.params.userId || "").trim();
    const action = String(req.body?.action || "accept").trim().toLowerCase();
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Phản hồi không hợp lệ" });
    }
    const result = await userStore.respondToFriendRequest(req.user.id, requesterId, action);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể phản hồi lời mời kết bạn" });
  }
};

exports.revokeFriendRequest = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu người dùng cần thu hồi lời mời" });
    }
    const result = await userStore.revokeFriendRequest(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể thu hồi lời mời kết bạn" });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng" });
    const result = await userStore.removeFriend(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể xóa bạn" });
  }
};

exports.blockFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng" });
    const result = await userStore.blockUser(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể chặn người dùng" });
  }
};

exports.blockedFriends = async (req, res) => {
  try {
    const users = await userStore.listBlockedUsers(req.user.id);
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Không thể tải danh sách đã chặn" });
  }
};

exports.unblockFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng" });
    const result = await userStore.unblockUser(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể bỏ chặn người dùng" });
  }
};

exports.chatRooms = async (req, res) => {
  try {
    const rooms = await multiChatStore.listRoomsForUser(req.user.id);
    const hydrated = await Promise.all(rooms.map((r) => multiChatStore.hydrateRoomForUser(r, req.user.id)));
    return res.json({ rooms: hydrated });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải phòng chat" });
  }
};

exports.chatRoomDetail = async (req, res) => {
  try {
    const room = await multiChatStore.getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng chat" });
    const isMember = room.members?.some((m) => m.id === req.user.id);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền truy cập phòng này" });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải chi tiết phòng chat" });
  }
};

exports.ensureDirectChat = async (req, res) => {
  try {
    const targetUserId = String(req.body?.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu ID người dùng" });
    const room = await multiChatStore.ensureDirectRoom(req.user.id, targetUserId);
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể khởi tạo hội thoại" });
  }
};

exports.createGroupChat = async (req, res) => {
  try {
    const room = await multiChatStore.createGroupRoom({
      ownerId: req.user.id,
      name: req.body?.name,
      avatarUrl: req.body?.avatarUrl,
      memberIds: req.body?.memberIds,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể tạo nhóm chat" });
  }
};

exports.groupInvites = async (req, res) => {
  try {
    const rooms = await multiChatStore.listGroupInvitesForUser(req.user.id);
    const invites = await Promise.all(rooms.map((room) => multiChatStore.hydrateRoomForUser(room, req.user.id)));
    return res.json({ invites });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải lời mời nhóm" });
  }
};

exports.inviteGroupMembers = async (req, res) => {
  try {
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const room = await multiChatStore.inviteMembersToGroup({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberIds
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể mời bạn vào nhóm" });
  }
};

exports.respondGroupInvite = async (req, res) => {
  try {
    const action = String(req.body?.action || "accept").trim().toLowerCase();
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Phản hồi không hợp lệ" });
    }
    const room = await multiChatStore.respondToGroupInvite({
      roomId: req.params.roomId,
      userId: req.user.id,
      action
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể phản hồi lời mời nhóm" });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const media = req.body?.media || null;
    const replyToMessageId = String(req.body?.replyToMessageId || "").trim();
    if (!text && !media) return res.status(400).json({ message: "Tin nhắn không được để trống" });

    const room = await multiChatStore.appendMessage({
      roomId: req.params.roomId,
      senderId: req.user.id,
      text,
      media,
      replyToMessageId
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];

    // ✅ Emit đúng event name + đúng room
    await emitToRoomMembers(room, { roomId: req.params.roomId, message: lastMessage });

    return res.json({ room: hydrated, message: lastMessage });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gửi tin nhắn" });
  }
};

exports.presignChatMediaUpload = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Chưa cấu hình S3. Đặt S3_BUCKET (hoặc AWS_S3_BUCKET), AWS_REGION và AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong backend/.env."
    });
  }
  try {
    const contentType = String(req.body?.contentType || "")
      .trim()
      .toLowerCase();
    let fileName = String(req.body?.fileName || "file").trim();
    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(contentType);
    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh, video hoặc tài liệu (.pdf/.doc/.docx)"
      });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ext) {
      const inferred = contentType.startsWith("video/")
        ? ".mp4"
        : contentType === "application/pdf"
          ? ".pdf"
          : contentType.includes("word")
            ? ".docx"
            : ".jpg";
      fileName += inferred;
    }
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    const { uploadUrl, publicUrl } = await createPresignedPut({
      key,
      contentType,
      expiresSec: 300
    });

    return res.json({
      uploadUrl,
      publicUrl,
      key,
      method: "PUT",
      headers: { "Content-Type": contentType }
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Không tạo được link upload media chat"
    });
  }
};

exports.uploadChatMedia = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message: "Chưa cấu hình S3."
    });
  }
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const contentType = file.mimetype;
    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(contentType);
    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh, video hoặc tài liệu (.pdf/.doc/.docx)"
      });
    }

    const fileName = file.originalname || "file";
    const ext = path.extname(fileName).toLowerCase();
    let safeName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100);
    if (!ext) {
      const inferred = contentType.startsWith("video/")
        ? ".mp4"
        : contentType === "application/pdf"
          ? ".pdf"
          : contentType.includes("word")
            ? ".docx"
            : ".jpg";
      safeName += inferred;
    } else {
      safeName += ext;
    }
    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    // Upload to S3
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const cfg = require("../config/s3").getConfig();
    const client = new S3Client({
      region: cfg.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: contentType
    });

    await client.send(command);

    // Generate GET URL
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const getCommand = new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key
    });
    const publicUrl = await getSignedUrl(client, getCommand, { expiresIn: 3600 * 24 * 7 });

    return res.json({
      url: publicUrl,
      key,
      contentType
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Không upload được media chat"
    });
  }
};

exports.unsendRoomMessage = async (req, res) => {
  try {
    const room = await multiChatStore.unsendMessage({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      requesterId: req.user.id,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể thu hồi tin nhắn" });
  }
};

exports.deleteRoomMessageForMe = async (req, res) => {
  try {
    const room = await multiChatStore.deleteMessageForUser({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      userId: req.user.id,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể xóa tin nhắn" });
  }
};

exports.forwardRoomMessage = async (req, res) => {
  try {
    const targetRoomId = String(req.body?.targetRoomId || "").trim();
    if (!targetRoomId) return res.status(400).json({ message: "Thiếu phòng chuyển tiếp" });

    const room = await multiChatStore.forwardMessage({
      sourceRoomId: req.params.roomId,
      messageId: req.params.messageId,
      targetRoomId,
      senderId: req.user.id,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];
    await emitToRoomMembers(room, { roomId: targetRoomId, message: lastMessage });

    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể chuyển tiếp tin nhắn" });
  }
};

exports.addGroupMember = async (req, res) => {
  try {
    const room = await multiChatStore.addGroupMember({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.body?.memberId,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể thêm thành viên" });
  }
};

exports.removeGroupMember = async (req, res) => {
  try {
    const room = await multiChatStore.removeGroupMember({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể xóa thành viên" });
  }
};

exports.assignDeputy = async (req, res) => {
  try {
    const room = await multiChatStore.assignDeputy({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
      enabled: true,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gán quyền phó nhóm" });
  }
};

exports.removeDeputy = async (req, res) => {
  try {
    const room = await multiChatStore.assignDeputy({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
      enabled: false,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gỡ quyền phó nhóm" });
  }
};

exports.dissolveGroup = async (req, res) => {
  try {
    await multiChatStore.dissolveGroup({
      roomId: req.params.roomId,
      requesterId: req.user.id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể giải tán nhóm" });
  }
};
