/*
 * Copyright (c) 2020-2024 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

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
const TOPICS = ['sensor/temperature', 'sensor/humidity', 'sensor/moisture_of_soil', 'sensor/ph_of_soil', 'sensor/ec_of_soil'];  // 여러 센서의 토픽
let FARM_ID = 'exampleFarmId';  // 농장 ID
        // 전역 변수 초기화
let previousTime = moment();
//온도
let temperature = 0;
let avgTemperature = 0;

//습도
let humidity = 0;
let avgHumidity = 0;

//토양 수분
let moistureOfSoil = 0;
let avgMoistureOfSoil = 0;

//토양 ph
let phOfSoil = 0;
let avgPhOfSoil = 0;

//토양 ec
let ecOfSoil = 0;
let avgEcOfSoil = 0;

let cnt = 0;
let currentTime = moment();

// a method that always returns the same value
service.register("hello", function(message) {
    console.log(logHeader, "SERVICE_METHOD_CALLED:/hello");
    console.log("In hello callback");
    const name = message.payload.name ? message.payload.name : "World";

    message.respond({
        returnValue: true,
        Response: "Hello, " + name + "!"
    });
});

service.register("konnichiwa", function(message){
    console.log(logHeader, "SERVICE_METHOD_CALLED:/konnichiwa");
    console.log("Konnichiwa!");
    const namae = message.payload.namae ? message.payload.namae : "SEKAI!";
    message.respond({
        returnValue: true,
        Response: "Konnichiwa! " + namae
    });
});





service.register("serviceOn", (message) => {

    let val = !active;
    if(active == false) {
        active = true; // 서비스 활성화
        cancel = false; // 서비스 중지 상태 해제
        console.log(logHeader, message);

        FARM_ID = message.payload.farmId ? message.payload.farmId : FARM_ID;  // 농장 ID
        // 전역 변수 초기화
        previousTime = moment();
        temperature = 0;
        avgTemperature = 0;
        humidity = 0;
        avgHumidity = 0;
        moistureOfSoil = 0;
        avgMoistureOfSoil = 0;
        phOfSoil = 0;
        avgPhOfSoil = 0;
        ecOfSoil = 0;
        avgEcOfSoil = 0;
        cnt = 0;

        // MQTT 클라이언트 생성
        const client = mqtt.connect(BROKER_ADDRESS, { port: PORT });

        // 새로운 메시지가 도착했을 때 호출되는 콜백 함수
        client.on('message', (topic, message) => {
            currentTime = moment();  // 현재 시간 업데이트

            // 매 분이 변경될 때마다 카운트 초기화
            if (previousTime.minute() !== currentTime.minute()) {
                cnt = 0;  // 카운트 리셋
            }

            cnt++;
            const msgValue = parseFloat(message.toString());  // 수신한 메시지를 숫자로 변환

            // 토픽에 맞는 데이터 처리
            switch (topic) {
                case 'sensor/temperature':
                    temperature = msgValue;
                    avgTemperature = cnt === 1 ? temperature : ((avgTemperature * (cnt - 1)) + temperature) / cnt;
                    break;
                case 'sensor/humidity':
                    humidity = msgValue;
                    avgHumidity = cnt === 1 ? humidity : ((avgHumidity * (cnt - 1)) + humidity) / cnt;
                    break;
                case 'sensor/moisture_of_soil':
                    moistureOfSoil = msgValue;
                    avgMoistureOfSoil = cnt === 1 ? moistureOfSoil : ((avgMoistureOfSoil * (cnt - 1)) + moistureOfSoil) / cnt;
                    break;
                case 'sensor/ph_of_soil':
                    phOfSoil = msgValue;
                    avgPhOfSoil = cnt === 1 ? phOfSoil : ((avgPhOfSoil * (cnt - 1)) + phOfSoil) / cnt;
                    break;
                case 'sensor/ec_of_soil':
                    ecOfSoil = msgValue;
                    avgEcOfSoil = cnt === 1 ? ecOfSoil : ((avgEcOfSoil * (cnt - 1)) + ecOfSoil) / cnt;
                    break;
            }

            // 이전 시간을 현재 시간으로 업데이트
            previousTime = currentTime;
        });

        // 브로커에 연결되었을 때 구독 설정
        client.on('connect', () => {
            console.log('Connected to broker');
            client.subscribe(TOPICS, (err) => {  // 여러 토픽을 배열로 구독
                if (err) {
                    console.error('Failed to subscribe to topics:', err);
                    message.respond({
                        returnValue: false,
                        Response: 'Failed to subscribe to topics'
                    });
                } else {
                    console.log('Subscribed to topics:', TOPICS);
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
                    console.log(heartbeatMax+" responses received, exiting...");
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
let x = 1;

function createHeartBeatInterval() {
    if (heartbeatinterval) {
        return;
    }
    console.log(logHeader, "create_heartbeatinterval");
    heartbeatinterval = setInterval(function() {
        sendResponses();
        sendPublishes();
    }, 1000);
}

// send responses to each subscribed client
function sendResponses() {
    console.log(logHeader, "send_response");
    console.log("Sending responses, subscription count=" + Object.keys(subscriptions).length);
    for (const i in subscriptions) {
        if (Object.prototype.hasOwnProperty.call(subscriptions, i)) {
            const s = subscriptions[i];
            
            s.respond({
                returnValue: true,
                temperature: temperature.toFixed(1),
                avgTemperature: avgTemperature.toFixed(1),
                humidity: humidity.toFixed(1),
                avgHumidity: avgHumidity.toFixed(1),
                moistureOfSoil: moistureOfSoil.toFixed(1),
                avgMoistureOfSoil: avgMoistureOfSoil.toFixed(1),
                phOfSoil: phOfSoil.toFixed(1),
                avgPhOfSoil: avgPhOfSoil.toFixed(1),
                ecOfSoil: ecOfSoil.toFixed(1),
                avgEcOfSoil: avgEcOfSoil.toFixed(1),
                currentHour: currentTime.hour()
            });
        }
    }
    x++;
}

function sendPublishes() {
    // 퍼블리시할 데이터 생성
    const dataToPublish = {
        temperature: temperature.toFixed(1),
        avgTemperature: avgTemperature.toFixed(1),
        humidity: humidity.toFixed(1),
        avgHumidity: avgHumidity.toFixed(1),
        moistureOfSoil: moistureOfSoil.toFixed(1),
        avgMoistureOfSoil: avgMoistureOfSoil.toFixed(1),
        phOfSoil: phOfSoil.toFixed(1),
        avgPhOfSoil: avgPhOfSoil.toFixed(1),
        ecOfSoil: ecOfSoil.toFixed(1),
        avgEcOfSoil: avgEcOfSoil.toFixed(1),
        currentHour: currentTime.hour()
    };

    // MQTT 브로커에 퍼블리시 (주제는 `{FARM_ID}/infos`)
    const topic = `${FARM_ID}/infos`;
    console.log(topic);
    const publishClient = mqtt.connect(BROKER_ADDRESS, { port: PORT });
    publishClient.publish(topic, JSON.stringify(dataToPublish), (err) => {
        if (err) {
            console.error(`Failed to publish to topic ${topic}:`, err);
        } else {
            console.log(`Published data to topic ${topic}:`, dataToPublish);
        }
    });
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

