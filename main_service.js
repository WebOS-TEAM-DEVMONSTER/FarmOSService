/*
 * Copyright (c) 2020-2024 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const mqtt = require('mqtt');
const pkgInfo = require('./package.json');
const Service = require('webos-service');
const broker = require('./mqtt_method/broker.js');
const service = new Service(pkgInfo.name); // Create service by service name on package.json
const logHeader = "[" + pkgInfo.name + "]";
let cancel = true;
let active = false;

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
    if(active==false){
        active = true;
        cancel = false;
        console.log(logHeader, message);

        let i = 0;
        let interval = setInterval(()=>{
            let url = "luna://com.webos.notification/createToast";
            let params = {
                message: `Hello! +${++i}`
            };
        
            service.call(url, params, (m2)=>{
                console.log(logHeader, "SERVICE_METHOD_CALLED:com.webos.notification/createToast");
            });

            if(cancel == true) {
                clearInterval(interval);
            }
        }, 3000);

        broker();

        //heartbeat 구독
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
                event: "beat " + x
            });
        }
    }
    x++;
}

var heartbeat = service.register("heartbeat");
heartbeat.on("request", function(message) {
    console.log(logHeader, "SERVICE_METHOD_CALLED:/heartbeat");
    message.respond({event: "beat"}); // initial response 
    if (message.isSubscription) { 
        subscriptions[message.uniqueToken] = message; //add message to "subscriptions" 
        if (!heartbeatinterval) {
            createHeartBeatInterval();
        }
    } 
}); 
heartbeat.on("cancel", function(message) { 
    delete subscriptions[message.uniqueToken]; // remove message from "subscriptions" 
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

