'use strict';

const fs = require('fs');
const assert = require('assert');

const absolutePaths = require('ep_etherpad-lite/node/utils/AbsolutePaths');
const apikeyFile = absolutePaths.makeAbsolute("./APIKEY.txt");
const apiKey = fs.readFileSync(apikeyFile, "utf8");

const api = require('etherpad-lite-client')

const axios = require("axios");
const db = require('ep_etherpad-lite/node/db/DB');
const Url = require('url-parse');

const etherpad = api.connect({
  apikey: apiKey,
  host: 'localhost',
  port: 9001,
})

const getMetadata = async (context) => {
  const getMetadata = await db.get(`efssmetadata:${context.pad.id}:${context.author}`);

  console.log('Getmetadata: ', getMetadata, '\n');
  if (getMetadata) {
    const queryParams = getMetadata.split(':');
    const wopiSrc = decodeURIComponent(queryParams[0])
    const wopiHost = Url(wopiSrc).origin;
    const accessToken = queryParams[1];
  
    console.log('wopiHost: ', wopiHost, ' : wopiSrc: ', wopiSrc, ' accessToken: ', accessToken);
  
    return [wopiHost, wopiSrc, accessToken];
  }
  else {
    return null;
  }
}

const axiosCall = (wopiHost, wopiSrc, accessToken, padID, close=false) => {
  let axiosURL = `${wopiHost}/wopi/bridge/${padID}?WOPISrc=${wopiSrc}&access_token=${accessToken}`;
  if (close === true) {
    axiosURL += '&close=true';
  }

  axios.post(axiosURL)
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

exports.setEFSSMetadata = async (hookName, context) => {
  context.app.post('/setEFSSMetadata', async (req, res) => {
    const query = req.query;
    console.log('Query: ', query, '\n');

    await etherpad.getAttributePool({padID: query.padID}, async (error, data) => {
      if (data !== null && (query.apikey === apiKey)) {
        if (!query.padID || !query.wopiSrc || !query.accessToken || !query.apikey)
          res.send({code: 1, message:"Insufficient params or null values supplied as arguments!"})
        else {
          await db.set(`efssmetadata:${query.padID}`, `${(query.wopiSrc)}:${query.accessToken}`);
          res.send({code: 0, message:"Content in DB set successfully"});
        }
      }
      else {
        res.send({code: 1, message: "PadID or API key is invalid!"})
      }
    });
  });
};

exports.padUpdate = function (hookName, context) {
  postToWopi(context);
}

exports.userJoin = async (hookName, {authorId, displayName, padId}) => {
  console.log(`UserJoin hook => Author: ${authorId} with DisplayName: (${displayName}) joined pad: ${padId}`);

  const dbkey = `efssmetadata:${padId}`;
  const dbval = await db.get(dbkey);
  await db.set(`${dbkey}:${authorId}`, dbval);
  await db.remove(dbkey);
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
      axiosCall(wopiHost, wopiSrc, accessToken, session.padId, true);
      await db.remove(`efssmetadata:${session.padId}:${session.author}`)
      
      resolve(console.log('User content from DB cleared successfully!'));
    }
  ))
  return;
}
