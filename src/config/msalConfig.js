'use strict';

const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

// Scopes needed to read the user's email and profile from Microsoft Graph
const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

module.exports = { msalClient, SCOPES };
