//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");


const app = express();



app.use(express.static("static"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));


app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());//this will setup passport for authenication
app.use(passport.session())//this will tell our app to use passport for dealing with session

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema( {
  email: String,
  password: String,
  googleId: String
  
});

userSchema.plugin(passportLocalMongoose);
//this will hash and salt our passport , and save it in mongo db
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());

//this is only with local startegy to serial. and deserial. data
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

//this is universal code of serial. and deserial.
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      //to overcome google+ api depreciation we r using this line of code otherwise no need
      //this will fetch userprofile from other endpoint other than using google+
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      //profile contains the email,userid and other contents in which we r interested too
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", function (req, res) {
    res.render("home")
});

app.get("/auth/google",
  //here google say the stratgery which is used by passport for authentication 
  passport.authenticate("google", { scope: ["profile"] })
);

//DON'T USE THIS AS IT WON'T REDIRECT TO GOOGLE SIGNUP

// app.get("/auth/google", function (req, res) {
//   passport.authenticate("google", { scope: ['profile'] })
// });

//this will redirect the google to after authen.
app.get("/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

//this will render only when user is already logged in
app.get("/secrets", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("secrets");
  }
  else {
    res.redirect("/login");
  }
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});


app.post("/register", function (req, res) {

  User.register({
    username: req.body.username
  },
    req.body.password, function (err, user) {
      if (err) {
        console.log(user);
        res.redirect("/register");
      }
      else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
  
});




app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function (err) {
    if (err)
    {
      console.log(err);
    }
    else
    {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
      }
  })

});

//cookies get deleted once the server restart
app.listen(3000, function () {
  console.log("server started at the port 3000.");
});
