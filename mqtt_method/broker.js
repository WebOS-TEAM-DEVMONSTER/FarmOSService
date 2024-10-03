const options = require('./info.js');

function broker() {
    const mqtt = require('mqtt');

    // MQTT 브로커에 연결 (로컬 브로커 사용 시 'mqtt://localhost')
    const client = mqtt.connect(options);

    client.on('connect', () => {
        console.log('Connected to MQTT broker');
        client.subscribe('sensor/temperature', (err) => {
          if (!err) {
            console.log('Subscribed to temperature topic');
          }
        });
      });
      
      client.on('message', (topic, message) => {
        if (topic === 'sensor/temperature') {
          console.log(`Temperature: ${message.toString()}`);
        }
      });
}
broker();
module.exports = broker;
