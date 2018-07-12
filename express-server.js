const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

const cookieParser = require('cookie-parser');
app.use(cookieParser());

const PORT = 8080;

const urlDatabase = {
  'b2xVn2': 'http://www.lighthouselabs.ca',
  '9sm5xK': 'http://www.google.com'
};

// Save userId, email and password for each registrant
const users = {};

app.set('view engine', 'ejs');

// Generates random 6 character string for userId and shortURL
function generateRandomString() {
  const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
  let randomString = '';

  for (let i = 0; i < 6; i++) {
    let random = Math.floor(Math.random() * 62);
    randomString += alphanumericChars[random];
  }

  return randomString;
}

// Returns urls created by a specific user
function urlsForUser(id) {
  const ownedUrls = {};

  for (let url in urlDatabase) {
    if (urlDatabase[url].userId === id) {
      ownedUrls[url] = urlDatabase[url].url;
    }
  }

  return ownedUrls;
}

app.get('/', (req, res) => {
  res.end('Hello!');
});

app.get('/login', (req, res) => {
  res.render('login', { user: users[req.cookies['user_id']] });
});

// Set user_id cookie and redirect to `/urls`
app.post('/login', (req, res) => {
  let userId;

  // If email is in `users` database, set userId
  for (let user in users) {
    if (users[user].email === req.body.email) {
      userId = user;
      break;
    }
  }

  // userId will be undefined if email is not in `users` database set 403 Forbidden
  // status code and return
  if (!userId) {
    res.status(403).send('Forbidden');
    return;
  }

  // if login password doesn't match password in `users`, set 403 Forbidden status
  // code and return
  if (users[userId].password !== req.body.password) {
    res.status(403).send('Incorrect password');
    return;
  }

  res.cookie('user_id', userId);
  res.redirect('/urls');
});

// Clears user_id cookie
app.post('/logout', (req, res) => {
  res.clearCookie('user_id');
  res.redirect('/urls');
});

app.get('/register', (req, res) => {
  res.render('register', { user: users[req.cookies['user_id']] });
});

app.post('/register', (req, res) => {
  // If email and/or password is empty, send 400 status code and return
  if (req.body.email === '' || req.body.password === '') {
    res.status(400).send('Bad Request.');
    return;
  }

  // If email has already been used to register, send 400 status code and return
  for (let id in users) {
    if (users[id].email == req.body.email) {
      res.status(400).send('Bad request.');
      return;
    }
  }

  const randomId = generateRandomString();

  users[randomId] = {
    id: randomId,
    email: req.body.email,
    password: req.body.password
  };

  res.cookie('user_id', randomId);
  res.redirect('/urls');
});

app.get('/urls', (req, res) => {
  const currentUser = req.cookies.user_id;
  const ownedUrls = urlsForUser(currentUser);

  const templateVars = {
    urls: ownedUrls,
    user: users[req.cookies['user_id']]
  };

  res.render('urls_index', templateVars);
});

app.get('/urls/new', (req, res) => {
  const currentUser = req.cookies.user_id;

  // Undefined if not logged in, redirect to login page
  if (!currentUser) {
    res.redirect('/login');
    return;
  }

  res.render('urls_new', { user: users[currentUser] });
});


// Add shortURL:longURL key:value pair to urlDatabase and redirect
app.post('/urls', (req, res) => {
  const currentUser = req.cookies.user_id;
  const longURL = req.body.longURL;
  const shortURL = generateRandomString();

  urlDatabase[shortURL] = {
    url: longURL,
    userId: currentUser
  };

  res.redirect(`/urls/${shortURL}`);
});

app.get('/urls/:key', (req, res) => {
  const shortURL = req.params.key;
  // If key is not in urlDatabase object, respond with `404: Not Found`.
  if (!(shortURL in urlDatabase)) {
    res.status(404).send('Resource Not Found');
    return;
  }

  const currentUser = req.cookies.user_id;
  // If user is not logged in, send 403 and return
  if (!currentUser) {
    res.status(403).send('Login to view this page.');
    return;
  }

  // If currentUser is not the owner of the shortURL, send 403 and return.
  if (currentUser !== urlDatabase[shortURL].user_id) {
    res.status(403).send('This is not your URL.');
    return;
  }

  const templateVars = {
    urls: urlDatabase,
    shortURL: req.params.key,
    user: users[req.cookies['user_id']]
  };

  res.render('urls_show', templateVars);
});

// Update shortURL to link to a different URL
app.post('/urls/:key/update', (req, res) => {
  const currentUser = req.cookies.user_id;
  const shortURL = req.params.key;
  const updatedURL = req.body.updatedURL;

  // if currentUser is not the shortURL owner, send 403 and return
  if (currentUser !== urlDatabase[shortURL].userId) {
    res.status(403).send('You are not the owner of that link.');
    return;
  }

  urlDatabase[shortURL].url = updatedURL;

  res.redirect(`/urls/${shortURL}`);
});

// Delete shortURL key-value pair from database; redirect to urls page
app.post('/urls/:key/delete', (req, res) => {
  const currentUser = req.cookies.user_id;
  const shortURL = req.params.key;

  // If current user is not the owner/creator of link, send 403 and return
  if (currentUser !== urlDatabase[shortURL].userId) {
    res.status(403).send('You are not the owner of that link.');
    return;
  }

  delete urlDatabase[shortURL];

  res.redirect('/urls');
});

// Redirect to linked URL
app.get('/u/:key', (req, res) => {
  let shortURL = req.params.key;
  let longURL = urlDatabase[shortURL].url;

  res.redirect(longURL);
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});