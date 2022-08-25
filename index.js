'use strict';

const axios = require("axios");
const api = require('ep_etherpad-lite/node/db/API');
const db = require('ep_etherpad-lite/node/db/DB');
const Url = require('url-parse');
const { debounce } = require('lodash');

const getMetadata = async (context) => {
  const getMetadata = await db.get(`efssmetadata:${context.pad.id}:${context.author}`);

  console.log({code: 0, metadataFromDb: getMetadata});
  if (getMetadata) {
    const queryParams = getMetadata.split(':');
    const wopiSrc = decodeURIComponent(queryParams[0])
    const wopiHost = Url(wopiSrc).origin;
    const accessToken = queryParams[1];
  
    console.log({code: 0, metadataQueryParams: {wopiHost: wopiHost, wopiSrc: wopiSrc, accessToken: accessToken}});
  
    return [wopiHost, wopiSrc, accessToken];
  }
  else {
    console.log({code: 0, metadataParams: null});
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
    axiosCall(wopiHost, wopiSrc, accessToken, context.pad.id);
  }
};

exports.setEFSSMetadata = async (hookName, context) => {
  context.app.post('/setEFSSMetadata', async (req, res) => {
    const query = req.query;
    console.log({code: 0, query: query});
    
    const response = await api.listAllPads();
    console.log({code: 0, padList: response});

    if (response.padIDs.length == 0 || (response.padIDs.includes(query.padID) && response.padIDs.length > 0)) {
      if (!query.padID || !query.wopiSrc || !query.accessToken || !query.apikey)
        res.send({code: 1, message:"Insufficient params or null values supplied as arguments!"})
      else {
        await db.set(`efssmetadata:${query.padID}`, `${(query.wopiSrc)}:${query.accessToken}`);
        res.send({code: 0, message:"Content in DB set successfully"});
      }
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
    console.log({code: 0, message: "metadata set in db successfully"});
    await db.remove(dbkey);
    console.log({code: 0, message: "removed initial metadata from db"});
  }
  else {
    throw new Error("metadata field missing in db!");
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
      const metadata = await getMetadata(param);
      const currentUsers = (api.padUsersCount(session.padId)).padUsersCount;

      console.log({code: 0, currentPadUsersCount: currentUsers});
      if (metadata !== null && currentUsers == 0) {
        const [wopiHost, wopiSrc, accessToken] = metadata;
        axiosCall(wopiHost, wopiSrc, accessToken, session.padId, true);
        await db.remove(`efssmetadata:${session.padId}:${session.author}`)
        
        resolve(console.log({code: 0, message:"User content from DB cleared successfully"}));
      }
      else {
        reject(console.log({code: 0, message: "Cannot exit when pad authors are still editing"}));
      }
    }
  ))
  return;
}
