// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------
var express = require('express'),
	exphbs = require('express-handlebars'),
	session = require('express-session'),
	path = require('path'),
	fs = require('fs'),
	util = require('util'),
	multipart = require('express-formidable').parse,
	bodyParser = require('body-parser'),
	BoxSDK = require('box-node-sdk'),
	mailer = require("nodemailer"),
	dialog = require('dialog');

// ------------------------------------------------------------------------------
// Application Parameters - Fill in with your app's values
// ------------------------------------------------------------------------------

var CLIENT_ID = '87j4q9x0ggeiv38k924ixj045x6ar2ee',
	CLIENT_SECRET = 'wouoyJrOpevkrABLIfw0BWxdlKx14nOD',
	PUBLIC_KEY_ID = 'j8p5jnv5',
	PRIVATE_KEY_PATH = './keys/private_key.pem',
	PRIVATE_KEY_PASSPHRASE = '123456',
	ENTERPRISE_ID = '13322858',
	MAIN_UPLOAD_LOCATION = 'folder1/folder2/folder3',
	WEBCAST_UPLOAD_LOCATION = 'folder4/folder5/folder6',
	SMTP_EMAIL_AUTHENTICATION_USER = 'dabieri1019@gmail.com',	
	SMTP_EMAIL_AUTHENTICATION_PASSWORD = 'polarispolaris123',
	TO_MAIL_ADDRESS = 'jianmyphy123@tutanota.com',
	MAIL_SUBJECT = "Jefferies 2016 Presentation Upload";

var myGlobalArr;
var myGlobalArrWebcast;
var isWebcast;



// Use Smtp Protocol to send Email

let smtpTransport = mailer.createTransport({
    service: 'gmail',
    auth: {
        user: SMTP_EMAIL_AUTHENTICATION_USER,
        pass: SMTP_EMAIL_AUTHENTICATION_PASSWORD
    }
});

// Set up Express and the Box SDK
var app = express(),
	sdk = new BoxSDK({
		clientID: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		appAuth: {
			keyID: PUBLIC_KEY_ID,
			privateKey: fs.readFileSync(path.resolve(__dirname, PRIVATE_KEY_PATH)),
			passphrase: PRIVATE_KEY_PASSPHRASE
		}
	});

// Use a single SDK client for the app admin, which will perform all operations
// around user management
var adminAPIClient = sdk.getAppAuthClient('enterprise', ENTERPRISE_ID);

// Set up the templating engine (Handlebars)
app.engine('hbs', exphbs({
	defaultLayout: 'main',
	extname: '.hbs'
}));
app.set('view engine', 'hbs');

// We need to parse POST bodies for form submissions
app.use(bodyParser.urlencoded({
	extended: false
}));

// Set up sessions, so we can log users in and out
app.use(session({
	secret: 'session secret',
	resave: false,
	saveUninitialized: false
}));

// User authentication middleware
// For this sample app, we trust that as long as the user's email has been set
// in the session, that they have been properly authenticated and we can create
// an SDK client for them
app.use(function(req, res, next) {
	if (req.session.email) {
		res.locals.email = req.session.email;
		req.sdk = sdk.getAppAuthClient('user', req.session.userID);
	}
	next();
});

app.get('/', function(req, res) {

	if (req.session.email) {
		// The user is logged in, send them to their upload page
		res.redirect('/boxupload');
	} else {
		// The user is logged out, render the home page
		res.render('home');
	}
});

app.get('/login', function(req, res) {
	res.render('login');
});

app.post('/login', function(req, res) {

	var email = req.body.email;

	var requestParams = {
		qs: {
			filter_term: email
		}
	};
	// Make an API request to get all users whose name starts with the provided email address
	// Since we use the Box name field to hold the email address that the user
	// registered with, this should give us the correct user object, if they've already
	// signed up.
	adminAPIClient.get('/users', requestParams, adminAPIClient.defaultResponseHandler(function(err, data) {

		if (err) {
			res.render('login', {
				error: 'An error occurred during login - ' + err.message,
				errorDetails: util.inspect(err)
			});
			return;
		}

		// Since the API call only checks that the filter term is a prefix, we
		// might get many matching records back from the API, so we need to
		// verify that there is an exact match before logging the user in
		var user = data.entries.find(match => match.name === email);
		if (!user) {
			res.render('login', {
				error: 'User not found'
			});
			return;
		}

		// Set up the user's logged-in session
		req.session.email = email;
		req.session.userID = user.id;
		res.redirect('/boxupload');
	}));
});

app.get('/signup', function(req, res) {
	res.render('signup');
});

app.post('/signup', function(req, res) {
	var requestParams = {
		body: {
			name: req.body.email,
			is_platform_access_only: true
		}
	};
	// Create a new Box user record for this user, using the name field to hold the
	// email address they registered with.  This allows us to use Box to keep track
	// of all our users, so we don't need a separate database for this sample app
	adminAPIClient.post('/users', requestParams, adminAPIClient.defaultResponseHandler(function(err, data) {

		if (err) {
			res.render('signup', {
				error: 'An error occurred during signup - ' + err.message,
				errorDetails: util.inspect(err)
			});
			return;
		}

		// If the user was created correctly, set up their logged-in session
		req.session.email = req.body.email;
		req.session.userID = data.id;
		res.redirect('/boxupload');
	}));
});

app.get('/boxupload', function(req, res) {

	// Guard to make sure the user is logged in
	if (!req.sdk) {
		res.redirect('/');
		return;
	}
	else {
		res.render('boxupload');
	}

});

app.get('/files', function(req, res) {

	// Guard to make sure the user is logged in
	if (!req.sdk) {
		res.redirect('/');
		return;
	}

	// Get the user's files in their root folder.  Box uses folder ID "0" to
	// represent the user's root folder, where we'll be putting all their files.
	req.sdk.folders.getItems('0', null, function(err, data) {

		res.render('files', {
			error: err,
			errorDetails: util.inspect(err),
			files: data ? data.entries: []
		});
	});
});

app.post('/startupload', multipart(), function(req, res) {

	// Guard to make sure the user is logged in
	if (!req.sdk) {
		res.redirect('/');
		return;
	}

	
	
	var tmpArr = MAIN_UPLOAD_LOCATION.split('/');
	myGlobalArr = [];
	for(i=0; i<tmpArr.length; i++) {
		if(tmpArr[i] != '')
			myGlobalArr.push(tmpArr[i]);
	}

	var tmpArr2 = WEBCAST_UPLOAD_LOCATION.split('/');
	myGlobalArrWebcast = [];
	for(i=0; i<tmpArr2.length; i++) {
		if(tmpArr2[i] != '')
			myGlobalArrWebcast.push(tmpArr2[i]);
	}

	isWebcast = req.body.webcasting == "yes" ? true : false;

	if(myGlobalArr.length == 0) {
		dialog.err('Main Upload Location is invalid.','Error');
		return;
	}
		

	//console.log(myGlobalArr);	
	createFolder(req, res, '0',myGlobalArr.shift());
	
});

function createFolder(req , res , parentID, folderName) {

	req.sdk.folders.create(parentID, folderName, function(err,data) {

		if(err && err.statusCode == 409 ) {
			
			var conflict_id = err.response.body.context_info.conflicts[0].id;

			if(myGlobalArr.length == 0)
				uploadFile(req, res,conflict_id);
			else
				createFolder(req, res,conflict_id, myGlobalArr.shift());
		}
		else {
			if(!data)
				return;
			var id = data.id;

			if(myGlobalArr.length == 0)
				uploadFile(req, res,id);
			else
				createFolder(req, res,id, myGlobalArr.shift());
		}
	});
}

function createFolderWebcast(req , res , parentID, folderName) {

	req.sdk.folders.create(parentID, folderName, function(err,data) {

		if(err && err.statusCode == 409 ) {
			
			var conflict_id = err.response.body.context_info.conflicts[0].id;

			if(myGlobalArrWebcast.length == 0)
				uploadFileWebcast(req, res,conflict_id);
			else
				createFolderWebcast(req, res,conflict_id, myGlobalArrWebcast.shift());
		}
		else {
			if(!data)
				return;
			var id = data.id;

			if(myGlobalArrWebcast.length == 0)
				uploadFileWebcast(req, res,id);
			else
				createFolderWebcast(req, res,id, myGlobalArrWebcast.shift());
		}
	});
}

function uploadFile(req, res,id) {
	// Get a read stream to the file that the user uploaded
	var fileStream = fs.createReadStream(req.body.file.path);

	var curDate = new Date();
	var fileName = (curDate.getMonth()+1)+"-"+curDate.getDate()+"-"+curDate.getHours()+"-"+curDate.getMinutes()+"-"+curDate.getSeconds()+"_"+
						req.body.company+"_"+req.body.file.name;
	
	// Make an API call to upload the user's file to Box
	req.sdk.files.uploadFile(id, fileName, fileStream, function(err, data) {
		
		if(err && err.statusCode == 409) {
			dialog.err('The File is existing in your box folder.','Error');
			res.redirect('/boxupload');
		}
		else {
			console.log(data);
			dialog.info('Successfully File Uploaded in your box folder\nLocation: '+MAIN_UPLOAD_LOCATION+"\nFile Name: "+fileName,'Success');
			if(isWebcast) {
				if(myGlobalArrWebcast.length == 0) {
					dialog.err('Webcast Upload Location is invalid.','Error');
					return;
				}
				createFolderWebcast(req, res, '0',myGlobalArrWebcast.shift());
			}
			else {
				sendMail(req,res);
			}
			
		}
		
	});
}

function uploadFileWebcast(req, res,id) {
	// Get a read stream to the file that the user uploaded
	var fileStream = fs.createReadStream(req.body.file.path);

	var curDate = new Date();
	var fileName = (curDate.getMonth()+1)+"-"+curDate.getDate()+"-"+curDate.getHours()+"-"+curDate.getMinutes()+"-"+curDate.getSeconds()+"_"+
						req.body.company+"_"+req.body.file.name;
	
	// Make an API call to upload the user's file to Box
	req.sdk.files.uploadFile(id, fileName, fileStream, function(err, data) {
		
		// Once the upload completes, delete the temporary file from disk
		fs.unlink(req.body.file.path, function() {});
		if(err && err.statusCode == 409) {
			dialog.err('The File is existing in your box webcast folder.','Error');
		}
		else {
			dialog.info('Successfully File Uploaded in your box webcast folder\nLocation: '+WEBCAST_UPLOAD_LOCATION+"\nFile Name: "+fileName,'Success');
		}
		sendMail(req,res);
	});
}

function sendMail(req,res) {
	var mailBody = 
		'<!DOCTYPE html>'+
		'<html lang="en">'+
		'<head>'+
			'<meta charset="UTF-8">'+
			'<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" type="text/css">'+
		'</head>'+
		'<body>'+
			'<h2 align="center">New Presenter Upload for <em>Jefferies 2016 Industrials Conference</em></h2>'+
			'<table width="392" border="1" align="center" cellpadding="6" class="table">'+
				'<tr>'+
					'<td width="105">Company:</td>'+
					'<td width="223">'+req.body.company+'</td>'+
				'</tr>'+
				'<tr>'+
					'<td>Presenter:</td>'+
					'<td>'+req.body.contact_name+'</td>'+
				'</tr>'+
				'<tr>'+
					'<td>Email:</td>'+
					'<td>'+req.body.email+'</td>'+
				'</tr>'+
				'<tr>'+
					'<td>Phone:</td>'+
					'<td>'+req.body.phone+'</td>'+
				'</tr>'+
				'<tr>'+
					'<td>Webcasting?</td>'+
					'<td>'+req.body.webcasting+'</td>'+
				'</tr>'+
				'<tr>'+
					'<td>Notes:</td>'+
					'<td>'+req.body.notes+'</td>'+
				'</tr>'+
				'<tr>'+
					'<td>Filename:</td>'+
					'<td>'+req.body.file.name+'</td>'+
				'</tr>'+
			'</table>'+
		'</body>'+
		'</html>';

	let mailOptions = {
		to: TO_MAIL_ADDRESS,
		subject: MAIL_SUBJECT,
		html: mailBody
	}

	smtpTransport.sendMail(mailOptions, function(error, response){
		if(error){
			dialog.info('Failed to send email.','Error');
		}
		else{
			dialog.info('Email Sended.','Success');
		}
		res.redirect('/boxupload');
	});
	
}

// The upload endpoint requires the multipart middleware to parse out the upload
// form body, which writes the uploaded file to disk at a temporary location
app.post('/upload', multipart(), function(req, res) {

	// Guard to make sure the user is logged in
	if (!req.sdk) {
		res.redirect('/');
		return;
	}

	// Get a read stream to the file that the user uploaded
	var fileStream = fs.createReadStream(req.body.file.path);
	// Make an API call to upload the user's file to Box
	req.sdk.files.uploadFile('0', req.body.file.name, fileStream, function(err, data) {

		// Once the upload completes, delete the temporary file from disk
		fs.unlink(req.body.file.path, function() {});

		res.redirect('/files');
	});
});

app.get('/download/:id', function(req, res) {

	// Guard to make sure the user is logged in
	if (!req.sdk) {
		res.redirect('/');
		return;
	}

	// API call to get the temporary download URL for the user's file
	req.sdk.files.getDownloadURL(req.params.id, null, function(err, url) {

		if (err) {
			res.redirect('/files');
			return;
		}

		// Redirect to the download URL, which will cause the user's browser to
		// start the download
		res.redirect(url);
	});
});

app.get('/preview/:id', function(req, res) {

	// Guard to make sure the user is logged in
	if (!req.sdk) {
		res.redirect('/');
		return;
	}

	// The Box file object has a field called "expiring_embed_link", which can
	// be used to embed a preview of the file.  We'll fetch this field only.
	req.sdk.files.get(req.params.id, {fields: 'expiring_embed_link'}, function(err, data) {

		if (err) {
			res.redirect('/files');
			return;
		}

		res.render('preview', {
			file: data
		});
	})
});

app.get('/thumbnail/:id', function(req, res) {

	// Guard to make sure the user is logged in
	if (!req.sdk) {
		res.redirect('/');
		return;
	}

	// API call to get the thumbnail for a file.  This can return either the
	// specific thumbnail image or a URL pointing to a placeholder thumbnail.
	req.sdk.files.getThumbnail(req.params.id, {}, function(err, data) {

		if (err) {
			res.status(err.statusCode || 500).json(err);
			return;
		}

		if (data.file) {
			// We got the thumbnail file, so send the image bytes back
			res.send(data.file);
		} else if (data.location) {
			// We got a placeholder URL, so redirect the user there
			res.redirect(data.location);
		} else {
			// Something went wrong, so return a 500
			res.status(500).end();
		}
	});
});

app.get('/logout', function(req, res) {

	// To log the user out, we can simply destroy their session
	req.session.destroy(function() {
		res.redirect('/');
	});
})

app.listen(3000);
console.log('Server started!');
console.log('Visit http://localhost:3000/ to start.');
