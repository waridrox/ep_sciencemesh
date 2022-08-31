'use strict';

const axios = require("axios");
const apikeyEtherpad = require('ep_etherpad-lite/node/handler/APIHandler').exportedForTestingOnly.apiKey;
const api = require('ep_etherpad-lite/node/db/API');
const db = require('ep_etherpad-lite/node/db/DB');
const { URL } = require('url');

const { debounce } = require('lodash');

const getMetadata = async (context) => {
  const getMetadata = await db.get(`efssmetadata:${context.pad.id}:${context.author}`).catch((err) => { console.error(err.message) })

  console.log(getMetadata ? {code: 0, metadataFromDb: getMetadata} : {code: 1, metadataFromDb: getMetadata});
  if (getMetadata) {
    const queryParams = getMetadata.split(':');
    const wopiSrc = decodeURIComponent(queryParams[0]);
    const wopiHost = new URL(wopiSrc).origin;
    const accessToken = queryParams[1];
  
    console.log({code: 0, metadataParams: {wopiSrc: wopiSrc}});
  
    return [wopiHost, wopiSrc, accessToken];
  }
  else {
    console.log({code: 0, metadataParams: null});
    return null;
  }
}

const wopiCall = (wopiHost, wopiSrc, accessToken, padID, close=false) => {
  let axiosURL = `${wopiHost}/wopi/bridge/${padID}?WOPISrc=${wopiSrc}&access_token=${accessToken}`;
  if (close === true) {
    axiosURL += '&close=true';
  }

  axios.post(axiosURL)
  .then((response) => {
    console.log({code: 0, response: JSON.stringify(response)});
  })
  .catch((error) => {
    console.log({code: 0, error: JSON.stringify(error)});
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
    console.log({code: 0, query: query});

    if (query.apikey === apikeyEtherpad) {
      console.log('APIKEY FROM APIHANDLER FUNC: ', apikeyEtherpad, 'APIKEY FROM QUERY: ', query.apikey);
  
      const padList = await api.listAllPads();
  
      if (padList.padIDs.length == 0 || padList.padIDs.includes(query.padID)) {
        if (!query.padID || !query.wopiSrc || !query.accessToken || !query.apikey)
          res.send({code: 1, message: "Insufficient params or null values supplied as arguments!"});
        else {
          await db.set(`efssmetadata:${query.padID}`, `${(query.wopiSrc)}:${query.accessToken}`);
          res.send({code: 0, message: "Content set successfully in db"});
        }
      }
    }

    else {
      console.error('Supplied PadID or API key in query is invalid');
    }
  });
};

exports.padUpdate = debounce((hookName, context) => {
  console.log({code: 0, message: `Pad content was updated after 3000 ms`});
  postToWopi(context);
}, 3000);

exports.userJoin = async (hookName, {authorId, displayName, padId}) => {
  console.log({code: 0, message: `${authorId} with DisplayName (${displayName}) joined pad ${padId}`});

  const dbkey = `efssmetadata:${padId}`;
  const dbval = await db.get(dbkey);

  if (dbval) {
    await db.set(`${dbkey}:${authorId}`, dbval);
    console.log({code: 0, message: "Author metadata set successfully in db"});
    await db.remove(dbkey);
  }
  else {
    throw new Error("Author data doesn\'t exist");
  }
}

exports.userLeave = function(hookName, session, callback) {

  console.log({code: 0, message:`${session.author} left pad ${session.padId}`});

  const param = {
    author: session.author,
    pad: {
      id: session.padId
    }
  };

  callback(new Promise(
    async (resolve, reject) => {

      const metadata = await getMetadata(param).catch((err) => { console.error(err.message) });

      if (metadata !== null) {
        const [wopiHost, wopiSrc, accessToken] = metadata;
        wopiCall(wopiHost, wopiSrc, accessToken, session.padId, true);
        await db.remove(`efssmetadata:${session.padId}:${session.author}`);

        resolve(console.log({code: 0, message:`Exited author content removed successfully from db`}));
      }
      else {
        reject(console.log({code: 0, message: `Author data doesn\'t exist`}));
      }
    }
  ))
  return;
}
