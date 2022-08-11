'use strict';

const axios = require("axios");
const db = require('ep_etherpad-lite/node/db/DB');

exports.padLoad = async function (pad, context) {
  console.log('Pad context: ', context);
}

const postToWopi = async (context) => {
  const getMetadata = await db.get(`efssmetadata:${context.pad.id}:${context.author}`);

  const queryParams = getMetadata.split(':');
  const wopiSrc = queryParams[0];
  const accessToken = queryParams[1];

  console.log('QueryParams: ', getMetadata);

  axios.post(`${wopiSrc}/wopi/bridge/${context.pad.id}?access_token=${accessToken}`, {
    headers: {
    'accept': '*/*' 
    },
  })
  .then((response) => {
    console.log(JSON.stringify(response));
  })
  .catch((error) => {
    console.log(JSON.stringify(error), "Couldn\'t POST data to the WOPI endpoint!");
  });
}

exports.setEFSSMetadata = (hookName, context) => {
  context.app.post('/setEFSSMetadata', async (req, res) => {
    const query = req.query;
    console.log('Query: ', query, '\n');

    let wopiSrc = query.wopiSrc;
    let accessToken = query.accessToken;

    console.log('wopiSrc: ', wopiSrc, 'accessToken: ', accessToken);
    
    if (!query.padID || !query.authorID || !query.wopiSrc || !query.accessToken)
      res.send({code: 1, message:"Insufficient params or null values supplied!"})
    else {
      await db.set(`efssmetadata:${query.padID}:${query.authorID}`, `${(query.wopiSrc)}:${query.accessToken}`);
      res.send({code: 0, message:"Content in DB set successfully"});
    }
  });
};

exports.padUpdate = function (hookName, context) {
  console.log('Pad was UPDATED', context)
  postToWopi(context);
}

exports.clientReady = function(hookName, message) {
  console.log('CLIENT IS READY', message, '\n');
};

exports.userJoin = async (hookName, {authorId, displayName, padId}) => {
  console.log(`Author: ${authorId} with DisplayName: (${displayName}) joined pad: ${padId}`);
}

exports.userLeave = function(hookName, session, callback) {
  console.log('%s left pad %s', session.author, session.padId, session);

  callback(new Promise(
    (resolve, reject) => {
        resolve(console.log('USER HAS LEFT THE PAD NOW'))
    }
  ))
  return;
}
