'use strict';

const axios = require("axios");
const db = require('ep_etherpad-lite/node/db/DB');
const Url = require('url-parse');

exports.padLoad = async function (pad, context) {
  console.log('Pad context: ', context);
}

const getMetadata = async (context) => {
  const getMetadata = await db.get(`efssmetadata:${context.pad.id}:${context.author}`);

  const queryParams = getMetadata.split('*');
  const wopiSrc = decodeURIComponent(queryParams[0])
  const wopiHost = Url(wopiSrc).origin;
  const accessToken = queryParams[1];

  console.log('wopiHost: ', wopiHost, ' : wopiSrc: ', wopiSrc, ' accessToken: ', accessToken);

  return [wopiHost, wopiSrc, accessToken];
}

const axiosCall = (wopiHost, wopiSrc, accessToken, padID, close=false) => {
  let axiosURL = `${wopiHost}/wopi/bridge/${padID}?WOPISrc=${wopiSrc}&access_token=${accessToken}`;
  if (close === true) {
    axiosURL += '&close=true';
  }

  axios.post(axiosURL, {
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

const postToWopi = async (context) => {
  const [wopiHost, wopiSrc, accessToken] = await getMetadata(context);
  axiosCall(wopiHost, wopiSrc, accessToken, context.pad.id);
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
      await db.set(`efssmetadata:${query.padID}:${query.authorID}`, `${(query.wopiSrc)}*${query.accessToken}`);
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

  const param = {
    author: session.author,
    pad: {
      id: session.padId
    }
  };

  callback(new Promise(
    async (resolve, reject) => {
      const [wopiHost, wopiSrc, accessToken] = await getMetadata(param);
      axiosCall(wopiHost, wopiSrc, accessToken, session.padId, close=true);
      await db.remove(`efssmetadata:${session.padId}:${session.author}`)
      
      resolve(console.log('User content from DB cleared successfully!'));
    }
  ))
  return;
}
