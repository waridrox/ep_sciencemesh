'use strict';

const fs = require('fs');
const { URL } = require('url');
const { debounce } = require('lodash');
const axios = require("axios");
const api = require('ep_etherpad-lite/node/db/API');
const db = require('ep_etherpad-lite/node/db/DB');
const absolutePaths = require('ep_etherpad-lite/node/utils/AbsolutePaths');
const apikey = fs.readFileSync(absolutePaths.makeAbsolute('APIKEY.txt')).toString();

const stringifyData = (data) => {
  return JSON.stringify(data);
};

const getMetadata = async (context) => {
  const getMetadata = await db.get(`efssmetadata:${context.pad.id}:${context.author}`).catch((err) => { console.error(JSON.stringify(err.message)) });

  console.log(getMetadata ? stringifyData({code:0,metadataFromDb: getMetadata}) : stringifyData({code:0,metadataFromDb: getMetadata}));
  if (getMetadata) {
    const queryParams = getMetadata.split(':');
    const wopiSrc = decodeURIComponent(queryParams[0]);
    const wopiHost = new URL(wopiSrc).origin;
    const accessToken = queryParams[1];

    console.log(stringifyData({code:0,metadataParams:{wopiSrc:`${wopiSrc} URL for serving requests to the WOPI server`}}));

    return [wopiHost, wopiSrc, accessToken];
  }
  else {
    console.log(stringifyData({code:0,metadataParams:`metadata values for WOPI server fetched as null from db`}));
    return null;
  }
};

const wopiCall = (wopiHost, wopiSrc, accessToken, padID, close=false) => {
  let axiosURL = `${wopiHost}/wopi/bridge/${padID}?WOPISrc=${wopiSrc}&access_token=${accessToken}`;
  if (close === true) {
    axiosURL += '&close=true';
  }
  axios.post(axiosURL, {}, {    // TODO it's more standard/elegant to pass query parameters as 2nd arg rather than in the URL
    headers: {
      'X-EFSS-Bridged-App': 'Etherpad'
    }
  })
  .then((response) => {
    console.log(stringifyData(response));
    if (response.status === 200) {
      console.log(stringifyData({code:0,message:`${response.statusText}, Request executed successfully`}));
    }
    if (response.status === 202) {
      console.log(stringifyData({code:0,message:`${response.statusText}, Enqueued action to the request`}));
    }
  })
  .catch((error) => {
    if (error.status === 400 || error.status === 500) {
      console.log(stringifyData({code:1,message:`${error.statusText}. This form of request is denied`}));
    }
    else {
      console.log(stringifyData({code:0,message:`Error occured while responding to the wopi request`}));
    }
  });
};

const postToWopi = async (context) => {
  const metadata = await getMetadata(context);

  if (metadata != null) {
    const [wopiHost, wopiSrc, accessToken] = metadata;
    wopiCall(wopiHost, wopiSrc, accessToken, context.pad.id);
  }
};

exports.setEFSSMetadata = async (hookName, context) => {
  context.app.post('/setEFSSMetadata', async (req, res) => {
    const query = req.query;

    console.log(stringifyData({code:0,query:query}));

    if (query.apikey !== apikey) {
      console.error('Supplied API key is invalid, apikey should be', apikey);
    }
      const mapperToGroupExists = await db.get(`mapper2group:1`).catch((err) => { return null; })
      const revisionCount = await api.getRevisionsCount(query.padID).catch((err) => { if (err.name === 'apierror') return null; });

      if ((mapperToGroupExists && !revisionCount) || revisionCount) {
        if (!query.padID || !query.wopiSrc || !query.accessToken || !query.apikey)
          res.send(stringifyData({code:0,message:"Insufficient params or null values supplied as arguments!"}));
        else {
          await db.set(`efssmetadata:${query.padID}`, `${(query.wopiSrc)}:${query.accessToken}`);
          res.send(stringifyData({code:0,message:"Content set successfully in db"}));
        }
      }
      else {
        console.error('PadID is invalid');
        res.send(stringifyData({code:1,message:"PadID is invalid"}));
      }
    }
  });
};

exports.padUpdate = debounce((hookName, context) => {
  console.log(stringifyData({code:0,message:`Pad content was updated after 3000 ms`}));
  postToWopi(context);
}, 3000);

exports.userJoin = async (hookName, {authorId, displayName, padId}) => {

  const dbkey = `efssmetadata:${padId}`;
  const dbval = await db.get(dbkey);

  if (dbval) {
    await db.set(`${dbkey}:${authorId}`, dbval);
    console.log(stringifyData({code:0,message:'Pad author metadata set successfully in db'}));
    await db.remove(dbkey);
  }
  else {
    throw new Error("Author data doesn\'t exist");
  }
};

exports.userLeave = function(hookName, session, callback) {
  const param = {
    author: session.author,
    pad: {
      id: session.padId
    }
  };

  callback(new Promise(
    async (resolve, reject) => {
      const metadata = await getMetadata(param).catch((err) => { console.error(err) });
      if (metadata !== null) {
        const [wopiHost, wopiSrc, accessToken] = metadata;
        wopiCall(wopiHost, wopiSrc, accessToken, session.padId, true);
        await db.remove(`efssmetadata:${session.padId}:${session.author}`);

        resolve(console.log(stringifyData({code:0,message:`Exited author content removed successfully from db`})));
      }
      else {
        reject(console.error(stringifyData({code:0,message:`Author data doesn\'t exist`})));
      }
    }
  ))
  return;
};
