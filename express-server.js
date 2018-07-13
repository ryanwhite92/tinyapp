require('dotenv').config();
const bcrypt = require('bcrypt');

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

const cookieSession = require('cookie-session');
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET, process.env.SESSION_SECRET2]
}));

const PORT = 8080;
const urlDatabase = {};
const users = {};

app.set('view engine', 'ejs');

// Generates string for userId and shortURL
function generateRandomString() {
  const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
  let randomString = '';

  // Randomly picks 6 characters from alphanumericChars and adds to random string
  for (let i = 0; i < 6; i++) {
    let random = Math.floor(Math.random() * 62);
    randomString += alphanumericChars[random];
  }

  return randomString;
}

// Returns an object containing urls created by a specific user
function urlsForUser(id) {
  const ownedUrls = {};

  for (let url in urlDatabase) {
    if (urlDatabase[url].userId === id) {
      ownedUrls[url] = urlDatabase[url].url;
    }
  }

  return ownedUrls;
}

// Redirects to `/urls` if user is logged in, otherwise redirects to `/login`
app.get('/', (req, res) => {
  const currentUser = req.session.userId;

  if (currentUser) {
    res.redirect('/urls');
    return;
  }

  res.redirect('/login');
});

app.get('/urls', (req, res) => {
  const currentUser = req.session.userId;

  if (!currentUser) {
    res.status(403).send('Forbidden.');
    return;
  }

  const ownedUrls = urlsForUser(currentUser);

  const templateVars = {
    urls: ownedUrls,
    user: users[currentUser]
  };

  res.render('urls_index', templateVars);
});

app.get('/urls/new', (req, res) => {
  const currentUser = req.session.userId;

  // Undefined if not logged in, redirect to login page
  if (!currentUser) {
    res.redirect('/login');
    return;
  }

  res.render('urls_new', { user: users[currentUser] });
});

app.get('/urls/:id', (req, res) => {
  const shortURL = req.params.id;
  // If id is not in urlDatabase object, respond with `404: Not Found`.
  if (!(shortURL in urlDatabase)) {
    res.status(404).send('Resource Not Found');
    return;
  }

  const currentUser = req.session.userId;
  // If user is not logged in, send 403 and return
  if (!currentUser) {
    res.status(403).send('Login to view this page.');
    return;
  }

  // If currentUser is not the owner of the shortURL, send 403 and return.
  if (currentUser !== urlDatabase[shortURL].userId) {
    res.status(403).send('Forbidden');
    return;
  }

  const templateVars = {
    urls: urlDatabase,
    shortURL: req.params.id,
    user: users[currentUser]
  };

  res.render('urls_show', templateVars);
});

// Redirect to linked URL
app.get('/u/:id', (req, res) => {
  const shortURL = req.params.id;

  // If shortURL is not in urlDatabase, send 404 and return
  if (!(shortURL in urlDatabase)) {
    res.status(404).send('Not Found.');
    return;
  }

  const longURL = urlDatabase[shortURL].url;

  res.redirect(longURL);
});

// Add shortURL:longURL key:value pair to urlDatabase and redirect
app.post('/urls', (req, res) => {
  const currentUser = req.session.userId;
  const longURL = req.body.longURL;
  const shortURL = generateRandomString();

  // If not logged in, send 403 status code and return
  if (!currentUser) {
    res.status(403).send('Login to access that feature.');
    return;
  }

  urlDatabase[shortURL] = {
    url: longURL,
    userId: currentUser
  };

  console.log(urlDatabase);

  res.redirect(`/urls/${shortURL}`);
});

// Update shortURL to link to a different URL
app.post('/urls/:id/update', (req, res) => {
  const currentUser = req.session.userId;
  const shortURL = req.params.id;
  const updatedURL = req.body.updatedURL;

  // if currentUser is not the shortURL owner, send 403 and return
  if (currentUser !== urlDatabase[shortURL].userId) {
    res.status(403).send('You are not the owner of that link.');
    return;
  }

  urlDatabase[shortURL].url = updatedURL;

  res.redirect(`/urls/${shortURL}`);
});

// Delete shortURL id-value pair from database; redirect to urls page
app.post('/urls/:id/delete', (req, res) => {
  const currentUser = req.session.userId;
  const shortURL = req.params.id;

  // If current user is not the owner/creator of link, send 403 and return
  if (currentUser !== urlDatabase[shortURL].userId) {
    res.status(403).send('You are not the owner of that link.');
    return;
  }

  delete urlDatabase[shortURL];

  res.redirect('/urls');
});

app.get('/login', (req, res) => {
  const currentUser = req.session.userId;

  // If user is logged in, redirect to `/urls`
  if (currentUser) {
    res.redirect('/urls');
    return;
  }

  res.render('login', { user: users[req.session.userId] });
});

app.get('/register', (req, res) => {
  const currentUser = req.session.userId;

if (currentUser) {
  res.redirect('/urls');
  return;
}

  res.render('register', { user: users[req.session.userId] });
});

// Set userId cookie and redirect to `/urls`
app.post('/login', (req, res) => {
  let userId;

  // If email and/or password is empty, send 400 status code and return
  if (req.body.email === '' || req.body.password === '') {
    res.status(400).send('Bad Request.');
    return;
  }

  // If email is in `users` database, set userId
  for (let user in users) {
    if (users[user].email === req.body.email) {
      userId = user;
      break;
    }
  }

  if (!userId) {
    res.status(403).send('Request Denied.');
    return;
  }

  // userId will be undefined if email is not in `users` database. If userId is
  // undefined or login password doesn't match hashed password in `users`, set
  // 403 Forbidden status code and return
  const checkPassword = bcrypt.compareSync(req.body.password, users[userId].password);
  if (!checkPassword) {
    res.status(403).send('Request Denied.');
    return;
  }

  req.session.userId = userId;
  res.redirect('/urls');
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
  const password = req.body.password;
  const hashedPassword = bcrypt.hashSync(password, 10);

  users[randomId] = {
    id: randomId,
    email: req.body.email,
    password: hashedPassword
  };

  req.session.userId = randomId;
  res.redirect('/urls');
});

// Clears userId cookie
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/urls');
});

// If page doesn't exist, send 404 error
app.get('*', (req, res) => {
  res.status(404).send('Not Found.');
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});