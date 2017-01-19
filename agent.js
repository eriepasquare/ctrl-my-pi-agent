
var gpio = require('rpi-gpio');
var express = require('express');
var fs = require('fs');
var https = require('https');

// ********* THE BELOW VARIABLES REQUIRE UPDATING FOR YOUR PERSONAL USE CASE

// define which Raspberry Pi GPIO pins should be activated/controlled by the agent.
// The order of pins is only important if you plan to use the odd/even controls in
// the REST API where the array index number is used to determine odd or even.
// NOTE: the array needs to contain pin numbers... NOT BCM/GPIO numbers.
var enabledPins = [18,3,22,16,29,15,31,13,32,11,33,7,36,12,37,5];

// configure your own certificate authority and private key
var ssl_opts = {
  // Server SSL private key and certificate (from environment variables)
  key: fs.readFileSync(process.env.SSL_SERVER_KEY),
  passphrase: process.env.SSL_SERVER_KEY_PP,
  cert: fs.readFileSync(process.env.SSL_SERVER_CERT),
  // issuer/CA certificate against which the client certificate will be validated.
  ca: fs.readFileSync(process.env.SSL_CA_CERT),
  // request and require a certificate
  requestCert: true,
  rejectUnauthorized: true
};

// ********* THE ABOVE VARIABLES REQUIRE UPDATING FOR YOUR PERSONAL USE CASE


// Create a new Express application.
var port = parseInt(process.env.PORT,10) || 3000;
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality
app.use(require('morgan')('combined'));

app.use(function(req, res, next) {
  if (!req.client.authorized) {
    var err = new Error('Access Denied');
    err.status = 401;
    next(err);  }
  next();
});

//******************************************************************************
// parameter middleware that will run before the next routes
//******************************************************************************

// validate the :mode parameter
app.param('mode', function(req, res, next, mode) {
    if ( (mode == "pin") || (mode == "gpio") ) {
      next();
    } else {
      res.status(500);
      res.render('error', { error: "Invalid request path! {mode} must be equal to \"gpio\" or \"pin\" for path: /{mode}/{id}/{action}"});
      return;
    }
});

// validate the :id parameter
app.param('id', function(req, res, next, id) {
    if ( (id == "all") || (id == "odd") || (id == "even") || !isNaN(id) ) {
      next();
    } else {
      res.status(500);
      res.render('error', { error: "Invalid request path! {id} must be a number or all/even/odd for path: /{mode}/{id}/{action}"});
      return;
    }
});

// validate the :action parameter
app.param('action', function(req, res, next, action) {
    if ( (action == "on") || (action == "off") || (action == "toggle") || (action == "status") ) {
      next();
    } else {
      res.status(500);
      res.render('error', { error: "Invalid request path! {action} must be on/off/roggle/status for path: /{mode}/{id}/{action}"});
      return;
    }
});

//******************************************************************************
app.get('/agent/config', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  res.render('agentconfig', { enabledPins: enabledPins, mapGpio: mapGpio });

});

app.get('/agent/:mode/:id/:action', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  mode   = req.params.mode;
  id     = req.params.id;
  action = req.params.action;

  var pins = [];
  var pinstate = [];

  // populate a temporary array (pins) with the pin(s) that will be modified
  if (!isNaN(id)) {
      // {id} is numeric, so now determine if we need to control pins or gpio
      id = parseInt(id);
      if (mode == "pin") {
          // for pin mode, make sure the pin provided has been enabled and then append it to the array
          if ( enabledPins.indexOf(id) > -1 ) {
              pins.push(id);
          }
          else {
              res.status(500);
              res.render('error', { error: "The pin requested "+id+" has not been enabled!" });
              return;
          }
      }
      else {
          // for gpio mode, convert the gpio number to a pin number and confirm it is enabled
          if ( enabledPins.indexOf(mapGpio[id]) > -1 ) {
              pins.push(mapGpio[id]);
          }
          else {
              res.status(500);
              res.render('error', { error: "The GPIO requested "+id+" has not been enabled!" });
              return;
          }
      }
  }
  else if (id == "all") {
      // doesn't matter if the request specifid gpio or pin mode...
      // just assign the array of all enabled pins
      pins = enabledPins;
  }
  // the even/odd designation refers to the index of the enabledPins array
  // and does NOT take the {mode} into consideration (gpio vs. pin)
  else if (id == "even") {
    enabledPins.forEach(function(pin){
      if (enabledPins.indexOf(pin) % 2 == 0 ) {
        pins.push(pin);
      }
    });
  }
  else if (id == "odd") {
    enabledPins.forEach(function(pin){
      if ( Math.abs(enabledPins.indexOf(pin) % 2) == 1 ) {
        pins.push(pin);
      }
    });

  }

  // ensure we successfully appended at least 1 pin to the pins array during parameter validation
  if (pins.length > 0) {
    if (action == "status") {
        pins.forEach(function(pin){
          gpio.read(pin, function(err, retval) {
            if (err) throw err;
            pinstate.push({pin: pin, state: retval});
            // if we're on the last pin in the array then send the response
            if (pins.indexOf(pin) == pins.length-1) {
              res.render('pinstate', { pinstate: pinstate });
            }
          });
        });
    }
    else if (action == "on") {
        pins.forEach(function(pin){
          gpio.write(pin, false, function(err) {
            if (err) throw err;
            pinstate.push({pin: pin, state: "false"});
            // if we're on the last pin in the array then send the response
            if (pins.indexOf(pin) == pins.length-1) {
              res.render('pinstate', { pinstate: pinstate });
            }
          });
        });
    }
    else if (action == "off") {
        pins.forEach(function(pin){
          gpio.write(pin, true, function(err) {
            if (err) throw err;
            pinstate.push({pin: pin, state: "true"});
            // if we're on the last pin in the array then send the response
            if (pins.indexOf(pin) == pins.length-1) {
              res.render('pinstate', { pinstate: pinstate });
            }
          });
        });
    }
    else if (action == "toggle") {
        pins.forEach(function(pin){
            // read current state of pin so we know how to toggle
            gpio.read(pin, function(err, value) {
                gpio.write(pin, !value, function(err) {
                  if (err) throw err;
                  pinstate.push({pin: pin, state: !value});
                  // if we're on the last pin in the array then send the response
                  if (pins.indexOf(pin) == pins.length-1) {
                    res.render('pinstate', { pinstate: pinstate });
                  }
                });
            });
        });

    } else {
      // if the action does not equal any of the expected values...
      res.status(500);
      res.render('error', { error: "Error identifying action to take" });
      return;
    }
  } else {
    // if the pins array has zero elements
    res.status(500);
    res.render('error', { error: "Error identifying pins to be controlled" });
    return;
  }
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.setHeader('Content-Type', 'application/json');
  res.render('error');
});

//******************************************************************************
// Initialize GPIO
//******************************************************************************

// The index of this array corresponds to the BCM/GPIO number and the value at that index
// is the physical pin number. For example: mapGpio[0] = pin number 27, mapGpio[27] = 13
var mapGpio = [27,28,3,5,7,29,31,26,24,21,19,23,32,33,8,10,36,11,12,35,38,40,15,16,18,22,37,13];

gpio.on('export', function(channel) {
    console.log('Channel set: ' + channel);
});

enabledPins.forEach(function(pin){
  console.log('Setting up pin #' + pin);
  gpio.setup(pin, gpio.DIR_OUT);
});

// Cleanup gpio before exiting
function closePins() {
    gpio.destroy(function() {
        console.log('All pins unexported');
        process.exit();
    });
}

// call closePins upon exiting
function exitHandler(options, err) {
    if (options.cleanup) console.log('clean');
    if (err) console.log(err.stack);
    if (options.exit) closePins();
}
//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));


// start the app/agent
https.createServer(ssl_opts, app).listen(port);

console.log("Listening on port: "+port);
