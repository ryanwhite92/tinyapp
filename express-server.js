const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

const urlDatabase = {
  'b2xVn2': 'http://www.lighthouselabs.ca',
  '9sm5xK': 'http://www.google.com'
};

// Save userId, email and password for each registrant
const users = {};

function generateRandomString() {
  const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
  let randomString = '';

  for (let i = 0; i < 6; i++) {
    let random = Math.floor(Math.random() * 63);
    randomString += alphanumericChars[random];
  }

  return randomString;
}

app.get('/', (req, res) => {
  res.end('Hello!');
});

app.get('/login', (req, res) => {
  res.render('login', { user: users[req.cookies['user_id']] });
});

// Set user_id cookie and redirect to `/urls`
app.post('/login', (req, res) => {
  let userId = undefined;

  // If email is in `users` database, set userId
  for (let user in users) {
    if (users[user].email === req.body.email) {
      userId = user;
    }
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
  let templateVars = {
    urls: urlDatabase,
    user: users[req.cookies['user_id']]
  };

  res.render('urls_index', templateVars);
});

app.get('/urls/new', (req, res) => {
  res.render('urls_new', { user: users[req.cookies['user_id']] });
});


// Add shortURL: longURL key:value pair to urlDatabase and redirect
// to another page (Browser sends another GET request).
app.post('/urls', (req, res) => {
  let shortURL = generateRandomString();
  urlDatabase[shortURL] = req.body.longURL;

  res.redirect(`/urls/${shortURL}`);
});

app.get('/urls/:key', (req, res) => {
  // If key is not in urlDatabase object, respond with `404: Not Found`.
  if (!(req.params.key in urlDatabase)) {
    res.status(404).send('Resource Not Found');
  } else {

    let templateVars = {
      urls: urlDatabase,
      shortURL: req.params.key,
      user: users[req.cookies['user_id']]
    };

    res.render('urls_show', templateVars);
  }
});

// Update shortURL to link to a different URL
app.post('/urls/:key/update', (req, res) => {
  const shortURL = req.params.key;
  const updatedURL = req.body.updatedURL;

  urlDatabase[shortURL] = updatedURL;

  res.redirect(`/urls/${shortURL}`);
});

// Delete shortURL key-value pair from database; redirect to urls page
app.post('/urls/:key/delete', (req, res) => {
  const deleteURL = req.params.key;

  delete urlDatabase[deleteURL];

  res.redirect('/urls');
});

// Redirect to linked URL
app.get('/u/:key', (req, res) => {
  let longURL = urlDatabase[req.params.key];

  res.redirect(longURL);
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});