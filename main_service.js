/*
 * Copyright (c) 2020-2024 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const { sendPictureToServer } = require('./send_picture_to_server.js');

const pkgInfo = require('./package.json');
const Service = require('webos-service');
const mqtt = require('mqtt');
const moment = require('moment');
const service = new Service(pkgInfo.name); // Create service by service name on package.json
const logHeader = "[" + pkgInfo.name + "]";


let cancel = true;
let active = false;

const BROKER_ADDRESS = 'mqtt://192.168.0.4';  // 브로커 주소 (mqtt://를 붙임)
const PORT = 1883;  // MQTT 기본 포트
let SENDTOPIC = "defaultTopic";

let TOPICS = ["sensor/temperature", "sensor/humidity", "sensor/moisture_of_soil", "sensor/ph_of_soil", "sensor/ec_of_soil"];
let FARM_ID = 'exampleFarmId';  // 농장 ID
        
//온도
let temperature = 0;
//습도
let humidity = 0;
//토양 수분
let moistureOfSoil = 0;
//토양 ph
let phOfSoil = 0;
//토양 ec
let ecOfSoil = 0;


service.register("serviceOn", (message) => {

    let val = !active;
    if(active == false) {
        active = true; // 서비스 활성화
        cancel = false; // 서비스 중지 상태 해제
        console.log(logHeader, message);

        FARM_ID = message.payload.farmId ? message.payload.farmId : FARM_ID;  // 농장 ID
        SENDTOPIC = `${FARM_ID}/infos`;

        // 변수 초기화


        // MQTT 클라이언트 생성
        const client = mqtt.connect(BROKER_ADDRESS, { port: PORT });

        // 새로운 메시지가 도착했을 때 호출되는 콜백 함수
        client.on('message', (topic, message) => {
            
            try {
                // 수신한 메시지를 JSON으로 파싱
                const msgValue = JSON.parse(message);
                console.log('Received message:', msgValue);
                // 센서 데이터 추출
                switch (topic) {
                    case "sensor/temperature":
                        temperature = msgValue ? msgValue : temperature;
                        break;
                    case "sensor/humidity":
                        humidity = msgValue ? msgValue : humidity;
                        break;
                    case "sensor/moisture_of_soil":
                        moistureOfSoil = msgValue ? msgValue : moistureOfSoil;
                        break;
                    case "sensor/ph_of_soil":
                        phOfSoil = msgValue ? msgValue : phOfSoil;
                        break;
                    case "sensor/ec_of_soil":
                        ecOfSoil = msgValue ? msgValue : ecOfSoil;
                        break;
                }

            } catch (error) {
                console.error("Failed to parse MQTT message as JSON:", error);
            }
        });

        // 브로커에 연결되었을 때 구독 설정
        client.on('connect', () => {
            console.log('브로커에 연결되었습니다.');
            client.subscribe(TOPICS, (err) => { 
                if (err) {
                    console.error('구독에 실패했습니다.', err);
                    message.respond({
                        returnValue: false,
                        Response: '구독에 실패했습니다.'
                    });
                } else {
                    console.log('구독에 성공했습니다.', TOPICS);
                }
            });
        });

        // heartbeat 구독
        const sub = service.subscribe('luna://com.devmonster.farmos.service/heartbeat', {subscribe: true});

        sub.addListener("response", function(msg) {
            console.log(JSON.stringify(msg.payload));
            if (cancel == true) {
                sub.cancel();
                setTimeout(function(){
                    console.log(" responses received, exiting...");
                    process.exit(0);
                }, 1000);
            }
        });
    }

    message.respond({
        returnValue: val,

        Response: val ? "My service has been started." : "service is already running."
    });
});

const subscriptions = {};
let heartbeatinterval;

function createHeartBeatInterval() {
    let x = 1;
    if (heartbeatinterval) {
        return;
    }
    console.log(logHeader, "create_heartbeatinterval");
    heartbeatinterval = setInterval(function() {
        sendResponses();
        x++;
        if(x > 20){
            sendPictureToServer();
            x = 1;
        }
    }, 3000);
}


// send responses to each subscribed client
function sendResponses() {
    const client = mqtt.connect(BROKER_ADDRESS, { port: PORT });

    console.log(logHeader, "send_response");
    console.log("Sending responses, subscription count=" + Object.keys(subscriptions).length);
    for (const i in subscriptions) {
        if (Object.prototype.hasOwnProperty.call(subscriptions, i)) {
            const s = subscriptions[i];
            
            s.respond({
                returnValue: true,
                temperature: temperature.toFixed(1),
                humidity: humidity.toFixed(1),
                moistureOfSoil: moistureOfSoil.toFixed(1),
                phOfSoil: phOfSoil.toFixed(1),
                ecOfSoil: ecOfSoil.toFixed(1),
            });

            const payload = {
                temperature: temperature.toFixed(1),
                humidity: humidity.toFixed(1),
                moistureOfSoil: moistureOfSoil.toFixed(1),
                phOfSoil: phOfSoil.toFixed(1),
                ecOfSoil: ecOfSoil.toFixed(1),
                timestamp: moment().toISOString()
            };
        
            client.publish(`${FARM_ID}/infos`, JSON.stringify(payload));
            console.log('퍼블리시 완료', `${FARM_ID}/infos`, payload);
        }
    }
}


var heartbeat = service.register("heartbeat");
heartbeat.on("request", function(message) {
    console.log(logHeader, "SERVICE_METHOD_CALLED:/heartbeat"); //하트비트 수신
    message.respond({
        event: "beat",
    }); // 처음 응답
    if (message.isSubscription) {  
        subscriptions[message.uniqueToken] = message; //메시지 구독
        if (!heartbeatinterval) {
            createHeartBeatInterval();
        }
    } 
}); 


heartbeat.on("cancel", function(message) { 
    delete subscriptions[message.uniqueToken]; // 구독 취소
    var keys = Object.keys(subscriptions); 
    if (keys.length === 0) { // count the remaining subscriptions 
        console.log("no more subscriptions, canceling interval"); 
        clearInterval(heartbeatinterval);
        heartbeatinterval = undefined;
    } 
});

service.register("serviceOff", (message) => {
    cancel = true;
    active = false;
    console.log(logHeader, message);
    message.respond({
        returnValue: true,
        Response: "My service has been stopped."
    });
});

