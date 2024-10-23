const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

// 파일 전송 함수
async function sendPictureToServer() {
  try {
    // /tmp 경로의 파일 목록 읽기
    const files = fs.readdirSync('/tmp');

    if (files.length === 0) {
      console.log('전송할 파일이 없습니다.');
      return;
    }

    // 첫 번째 파일 선택
    const firstFile = files[0];
    const filePath = path.join('/tmp', firstFile);

    console.log(`전송할 파일: ${filePath}`);

    // FormData 객체에 파일 추가
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // 서버로 POST 요청
    const response = await axios.post('http://52.63.12.126:8001/upload', form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    console.log('파일 전송 성공:', response.data);

    // 파일 삭제
    fs.unlink(filePath, (err) => {
      if (err) throw err;
      console.log('파일 삭제 완료');
    });

  } catch (error) {
    console.error('파일 전송 오류:', error);
  }
}

// 모듈 export
module.exports = { sendPictureToServer };
