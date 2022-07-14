'use strict';

const axios = require("axios");
const db = require('ep_etherpad-lite/node/db/DB');
const URL = "http://192.168.1.5:8880";

const postData = async (pad_content) => {

  // const params = {}

  // get the metadata and store it in the db or the session
  // the wopi server will pull the content every now and then and decide to save
  
  // WOPI endpoint - wopi/bridge/pad_id/
  try {
    const dbkey = await db.get('X-EFSS-Metadata')  
    console.log('META - DATA', dbkey)

    const { data } = await axios.post(URL + `/wopi/bridge/${pad_content.pad.id}`, null,
    {
      params: {
        isUserActive: true
      },
      headers: {
        'Content-Type': 'application/json',
      }
  });

  console.log(' ========> Data: ', data)
  } catch (error) {
    console.log('Error: ', error)
  }
}

exports.padCreate = function (pad, author) {
    console.log(`Pad: ${pad} || Author: ${author}`)
}

exports.padLoad = function (pad, context) {
    console.log('Pad was LOADED')
}

exports.padUpdate = async function (pad, context) {
    await db.set(`'X-EFSS-Metadata': ${context}`);

    console.log('Pad was UPDATED | CONTEXT ===============>', context)

    postData(context);
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
