var express = require('express');
var router = express.Router();

const multer = require("multer");
const crypto = require("crypto");
const passport = require("passport")
const userModel = require("./users.js");
const fs = require('fs');
const path = require("path");


const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));


// multer code for upload images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images/postUploads')
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(10, function (err, buff) {
      const fn = buff.toString("hex") + path.extname(file.originalname)
      cb(null, fn);
    })

  }
})
const upload = multer({ storage: storage, fileFilter: fileFilter })
function fileFilter(req, file, cb) {
  if (file.mimetype === "image/png" || file.mimetype === "image/jpg" || file.mimetype === "image/jpeg") {
    cb(null, true)
  }
  else {
    cb(new Error('file formate should be png,jpg,jpeg'), false)
  }
}

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('signin',);
});

// register user route
router.post('/register', function (req, res, next) {
  var data = new userModel({
    email: req.body.email,
    username: req.body.username,
    number: req.body.number,
  })
  userModel.register(data, req.body.password)
    .then(function (u) {
      passport.authenticate('local')(req, res, function () {
        res.redirect("/index");
      })
    })
    .catch(function (e) {
      res.send(e);
    })
});

// login route
router.get('/login', function (req, res, next) {
  res.render('login',);
});
router.post('/login', passport.authenticate('local', {
  successRedirect: '/index',
  failureRedirect: '/'
}), function (req, res, next) { })

// logout rout
router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
})

// isloggedin function
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/login');
  }
}


// get home page of application
router.get('/index', isLoggedIn, async function (req, res, next) {
  const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
  res.render('index', { loggedInUser });
});

// get list ad page
router.get('/listroom', isLoggedIn, async function (req, res, next) {
  const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
  res.render('listroom', { loggedInUser });
});


// save ad form
router.post("/uploadpost", isLoggedIn, upload.array("images", 4), async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ username: req.session.passport.user });

    if (!loggedInUser) {
      return res.status(404).send("User not found");
    }

    const images = req.files.map(file => file.filename);

    const newPost = {
      type: req.body.type,
      city: req.body.city,
      area: req.body.area,
      description: req.body.description,
      number: req.body.number,
      price: req.body.price,
      images: images,
    };

    loggedInUser.posts.push(newPost);
    await loggedInUser.save();


    res.render("profile", { loggedInUser });
  } catch (error) {
    console.error("Error uploading post:", error);
    res.status(500).send("An error occurred while uploading the post.");
  }
});

// delete ad
router.get("/delete/:postId", isLoggedIn, async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
    if (!loggedInUser) {
      return res.status(404).send("User not found");
    }
    const postIdToDelete = req.params.postId;

    // Find the index of the post in the user's posts array
    const postIndex = loggedInUser.posts.findIndex(post => post._id.toString() === postIdToDelete);
    if (postIndex === -1) {
      return res.status(404).send("Post not found");
    }
    // Remove the post from the array
    loggedInUser.posts.splice(postIndex, 1);
    await loggedInUser.save();
    res.render("profile", { loggedInUser });

  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).send("An error occurred while deleting the post.");
  }
});

//profile page for myad and saved add
router.get('/profile', isLoggedIn, async function (req, res, next) {
  const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
  res.render('profile', { loggedInUser });
});


router.get('/findroom', isLoggedIn, async function (req, res, next) {
  const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
  const allUsers = await userModel.find();
  const allPosts = await userModel.find({}, 'username posts')

  res.render('findroom', { loggedInUser, allUsers, allPosts });
});

router.get('/card/:postId', async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ username: req.session.passport.user });

    const postId = req.params.postId;
    const user = await userModel.findOne({ 'posts._id': postId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const post = user.posts.find((p) => p._id.toString() === postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.render("card", { post, loggedInUser });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/save', async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
    res.render("save", {  loggedInUser });

    const bookmarkedPostIds = loggedInUser.savePost;
    console.log(bookmarkedPostIds);
  
    const bookmarkedUsers = await userModel.find({ 'posts._id': { $in: bookmarkedPostIds } }).populate('posts.post');
    console.log(bookmarkedUsers);
  
    res.render('save', { bookmarkedUsers, loggedInUser });

  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/save/:id', async (req, res) => {
  try {
      const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
      const postId = req.params.id;
    
      const bookmarkIndex = loggedInUser.savePost.indexOf(postId);
    
      if (bookmarkIndex === -1) {
        loggedInUser.savePost.push(postId);
      } else {
        loggedInUser.savePost.splice(bookmarkIndex, 1);
      }
    
      await loggedInUser.save();
    
      res.render("save", {  loggedInUser });

  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/edit', async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
    res.render("edit", {  loggedInUser });

  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/edit-profile/:id',upload.single("profile"), async (req, res) => {
  try {
    const loggedInUser = await userModel.findOne({ username: req.session.passport.user });
    if (!loggedInUser) {
      return res.status(404).send("User not found");
    }
    const profile = req.body.files;

    const newUser = {
      username : req.body.username,
      number : req.body.number,
      city : req.body.city,
      gender : req.body.gender,
      profile : profile
    }

    const user = await userModel.findByIdAndUpdate(req.params.id,newUser);

    console.log(user);

    res.render("edit", {  loggedInUser });

  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
