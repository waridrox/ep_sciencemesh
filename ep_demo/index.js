'use strict';

var fs = require('fs');
const apiKey = fs.readFileSync('./APIKEY.txt', 'utf8');

const util = require('util');
const axios = require("axios");
const db = require('ep_etherpad-lite/node/db/DB');

const URL = "http://192.168.1.8:8880";

const api = require('etherpad-lite-client')
const etherpad = api.connect({
  apikey: apiKey,
  host: 'localhost',
  port: 9001,
})

const postData = async (pad_content) => {

  let data = JSON.stringify({
    'authorId': pad_content.author,
    'padId': pad_content.pad.id,
    'apiKey': apiKey
});
    axios({
      method: "POST",
      url: URL + `/wopi/bridge/${pad_content.pad.id}`,
      data: data,
      headers: { 'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': data.length,
        'X-EFSS-Metadata': data,
        'accept': '*/*' },
    })
      .then(function (response) {
        console.log(response);
      })
      .catch(function (response) {
        console.log(response);
      });
    };

exports.padCreate = function (pad, context) {
    console.log(pad, context)
}

exports.padLoad = function (pad, context) {
    console.log('Pad was LOADED')
    console.log(pad, context)
}

exports.padUpdate = function (hook_name, context) {

    console.log('Pad was UPDATED | CONTEXT ===============>', context)

    postData(context);

    var args = {
      padID: context.pad.id
    }
    etherpad.padUsers(args, function(error, data) {
      if(error) console.error('Error during api call for pad: ' + error.message)
      else console.log('Current PadUsers: ', JSON.stringify(data))
    })

}

exports.userLeave = function(hook, session, callback) {
  console.log('%s left pad %s', session.author, session.padId, session);

  // After the user has left the session the pad gets stored in the actual DB
  // Can be used to invoke a function that does things after saving to the DB
  callback(new Promise(
    (resolve, reject) => {
        resolve(console.log('USER HAS LEFT THE PAD NOW'))
    }
  ))
  return;
}

exports.exportFileName = function(hook, padId, callback){
  callback("cernbox_etherpad_"+padId);
}

exports.padRemove = function (pad_id) {
  console.log('Pad was removed');
}
