import {options} from './info.js';

function publish() {
    const mqtt = require('mqtt');

    // MQTT 브로커에 연결 (로컬 브로커 사용 시 'mqtt://localhost')
    const client = mqtt.connect(options);

    // MQTT 브로커와 연결되었을 때 실행되는 함수
    client.on('connect', () => {
    console.log('Connected to MQTT broker');

    // 주기적으로 온도 데이터를 발행
    setInterval(() => {
        const temperature = (Math.random() * 10 + 20).toFixed(2); // 20~30도 사이의 랜덤 값 생성
        const message = JSON.stringify({ temperature });

        // 'sensor/temperature' 토픽에 메시지 발행
        client.publish('sensor/temperature', message, () => {
        console.log(`Published: ${message}`);
        });
    }, 5000); // 5초마다 데이터 발행
    });

    // 오류 발생 시 처리
    client.on('error', (err) => {
    console.error('Connection error: ', err);
    client.end();
    });
}

module.exports = publish;