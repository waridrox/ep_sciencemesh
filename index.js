'use strict';

require('dotenv').config({ path: '/.env' })

const fs = require('fs');
const apiKey = fs.readFileSync('./APIKEY.txt', 'utf8');
const api = require('etherpad-lite-client')
const db = require('../src/node/db/DB')
const axios = require("axios");

const wopiURL = "http://127.0.0.1:8880";

// Etherpad API to test in-built API functions
const etherpad = api.connect({
  apikey: apiKey,
  host: 'localhost',
  port: 9001,
})

exports.padLoad = async function (pad, context) {
  console.log('Pad was LOADED => ', context);
}

const postToWopi = async (padID) => {
  const metadataFromDB = await db.get(`metadata:${padID}`);
  console.log(metadataFromDB);

  axios({
    method: "POST",
    url: `${wopiURL}/wopi/bridge/JGf2fombs8Ap2QOatZvh`,
    headers: {
      'X-EFSS-Metadata': metadataFromDB,
      'accept': '*/*' 
    },
  })
  .then(function (response) {
    console.log(JSON.stringify(response));
  })
  .then(function (response) {
    console.log(JSON.stringify(response));
  })
  .catch(function (error) {
    console.log(JSON.stringify(error));
    console.log('Couldn\'t POST data to the WOPI endpoint!');
  });
}

exports.setMetadataForEFSS = async (_hookName, context) => {
  context.app.get('/setMetadataForEFSS/:padID', async (req, res) => {

    const params = req.params;
    const query = req.query;
    console.log('Params: ', params, '\n', 'Query: ', query, '\n');

    let metadata = query.metadata;
    console.log('metadata', metadata);
    await db.set(`${metadata}:${params.padID}`, `${query.author_id}`);

    res.send(`${metadata}:${params.padID}:${query.author_id}`)
    
    await postToWopi(params.padID);
  });
}

exports.clientReady = function(hook, message) {
  console.log('CLIENT_READY FUNCTION INVOKED', message, '\n');
};

exports.userJoin = async (hookName, {authorId, displayName, padId}) => {
  console.log(`Author: ${authorId} with DisplayName: (${displayName}) joined pad: ${padId}`);
}

exports.padUpdate = async function (hook_name, context) {
  console.log('Pad was UPDATED', context)
  // this doesn't work since padUpdate is supposed to be synchronous
  // await postToWopi(context.pad.id);
}

exports.userLeave = function(hook, session, callback) {
  console.log('%s left pad %s', session.author, session.padId, session);

  callback(new Promise(
    (resolve, reject) => {
        resolve(console.log('USER HAS LEFT THE PAD NOW'))
    }
  ))
  return;
}
