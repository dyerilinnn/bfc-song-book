require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Song = require('../models/Song');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gerylynguiller_db_user:v57XQFrzCEEkw7ub@mo.7nbid9u.mongodb.net/?appName=MO';
const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'the-lord-is-my-shepherd-psalms2316';

const sample = [
  {
    title: 'How Great Is Our God',
    singer: 'Chris Tomlin',
    originalKey: 'C',
    bpm: '78',
    lyrics: [
      'Verse 1:',
      'The [1]splendor of a [5]King, clothed in [6]majesty',
      'Let all the [4]earth rejoice, all the [1]earth re[5]joice',
      '',
      'Chorus:',
      'How [1]great is our [4]God',
      'Sing with me how [3]great is our [2]God',
      'And all will [4]see how great, how [5]great is our [1]God'
    ].join('\n')
  },
  {
    title: 'Great Are You Lord',
    singer: 'All Sons & Daughters',
    originalKey: 'G',
    bpm: '72',
    lyrics: [
      'Verse 1:',
      'You give [1]life, You are [5]love',
      'You bring [6]light to the [4]darkness',
      '',
      'Chorus:',
      'It\u2019s Your [1]breath in our [5]lungs',
      'So we [6]pour out our [4]praise to You only'
    ].join('\n')
  }
];

(async () => {
  await mongoose.connect(MONGODB_URI);

  const existing = await Admin.findOne({ username });
  if (existing) {
    existing.passwordHash = await Admin.hash(password);
    await existing.save();
    console.log('Reset the password for admin "' + username + '".');
  } else {
    await Admin.create({ username, passwordHash: await Admin.hash(password) });
    console.log('Created admin "' + username + '".');
  }

  if ((await Song.countDocuments()) === 0) {
    await Song.insertMany(sample);
    console.log('Added ' + sample.length + ' sample songs.');
  }

  await mongoose.disconnect();
})();
