const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const { Schema } = mongoose;

const MongoStore = require('connect-mongo');

/*const connection = mongoose.connect('mongodb://localhost:27017/PAW_Data', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Mongodb successfully connected');
});*/

const connection = mongoose.connect('mongodb+srv://admin:5JMkBxRlLWkstpUT@paw-data.dys4s7v.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Mongodb successfully connected');
});

const sessionStore = new MongoStore({
  mongooseConnection: connection,
  collection: 'sessions',
  mongoUrl: 'mongodb://localhost:27017/PAW_Data',
  autoRemove: 'native'
})

const accountSchema = new mongoose.Schema({
  ufid: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: Number,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  officer: Boolean
});

const Account = mongoose.model('Account', accountSchema);

const eventSchema = new mongoose.Schema({
  name: String,
  capacity: Number,
  date: String,
  //add rides data to this array
  signed_up_users: []

});

const Event = mongoose.model('Event', eventSchema);

function addAccount(done, _ufid, _name, _phone, _email)
{
  const newAccount = new Account({
    ufid: _ufid,
    name: _name,
    phone: _phone,
    email: _email,
    officer: false
  });
  newAccount.save((err, data) => {
    if (err)
      return done(err);
    done(null, data);
  });
}

//add ufid to session
async function findUser(_ufid, req, res)
{
  try {
    let user = await Account.findOne({ufid: _ufid});
    if (user === null)
      throw InternalError;
    //return user;
    req.session.ufid = _ufid;
    //res.sendFile(__dirname + "/logged_in.html");
    res.redirect("/auth");
  }
  catch(e) {
    console.error(e.message);
    res.sendFile(__dirname + "/ufid_not_recognized.html");
  }
}

app.use(bodyParser.urlencoded({extended: false}));
app.use(express.json());
app.use(session({
  secret: 'b89cb8qgbbcc',
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    maxAge: 1000*60*60*24
  }
}));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/main.html");
})

app.get("/join_event/:id", (req, res) => {
  if('ufid' in req.session)
  {
    Event.findById(req.params.id, (err, event) => {
      if (err)
        console.error(err);
      else
      {
        //join event
        //find user
        Account.findOne({ufid: req.session.ufid}, (err, user) => {
          if (err)
            console.error(err);
          else
          {
            //add user to event list
            event.signed_up_users.push({user_object: user,
                                        needs_ride: false,
                                        passengers: 0});
            
            //save new list
            event.save((err, newEvent) => {
              if (err)
                console.error(err);
              console.log(newEvent);
              //redirect to signup page
              res.redirect("/auth");
            });
          }
        });
      }
    })
  }
  else
    res.sendFile(__dirname + "/login.html");
})

app.get("/leave_event/:id", (req, res) => {
  if('ufid' in req.session)
  {
    Event.findById(req.params.id, (err, event) => {
      if (err)
        console.error(err);
      else
      {
        //leave event
        //find user
        Account.findOne({ufid: req.session.ufid}, (err, user) => {
          if (err)
            console.error(err);
          else
          {
            //remove from event list
            for (let i = 0; i < event.signed_up_users.length; i++)
                if (JSON.stringify(user) == JSON.stringify(event.signed_up_users[i].user_object))
                {
                  event.signed_up_users.splice(i, 1);
                  i--;
                }
            //save new list
            event.save((err, newEvent) => {
              if (err)
                console.error(err);
              //redirect to signup page
              res.redirect("/auth");
            });/*.then(() => {
              console.log('Successfully saved new user')
            });*/
            
          }
        });
      }
    })
  }
  else
    res.sendFile(__dirname + "/login.html");
})

app.get("/view_event/:id", (req, res) => {
  let view_event_html = `<!DOCTYPE html>
  <html lang="en">
      <head>
          <meta charset="utf-8">
          <h1>Roster</h1><br>
          <style>
              td {
                  padding: 0 50px;
              }
          </style>
      </head>
      <body>
          <table>
              <tr>
                  <th>Name</th>
                  <th>Phone Number</th>
                  <th>Can Carpool (# of passengers)</th>
                  <th>Needs Ride</th>
              </tr>`;
  if('ufid' in req.session)
  {
    Event.findById(req.params.id, (err, event) => {
      if (err)
        console.error(err);
      else
      {
        //leave event
        //find users
        Account.find({}, (err, users) => {
          if (err)
            console.error(err);
          else
          {
            //display roster
            let logged_in_event = false;
            for (let i = 0; i < users.length; i++)
            {
              let signed_up_for_event = false;
              let self = false;
              let num_passengers = 0;
              let need_ride = false;
              if (req.session.ufid == users[i].ufid)
              {
                self = true;
              }
              for (let j = 0; j < event.signed_up_users.length; j++)
              {
                if (JSON.stringify(users[i]) == JSON.stringify(event.signed_up_users[j].user_object))
                {
                  signed_up_for_event = true;
                  num_passengers = event.signed_up_users[j].passengers;
                  need_ride = event.signed_up_users[j].needs_ride;
                }
              }
              if (signed_up_for_event)
              {
                view_event_html += `<tr><td>${users[i].name}</td>
                <td>${users[i].phone}</td>
                
                <td>${num_passengers}</td>
                <td>${need_ride}</td></tr>`;
              }
              if (signed_up_for_event && self)
                logged_in_event = true;
              signed_up_for_event = false;
              self = false;
            }
          view_event_html += `</table>`;
          //Form should not appear if user is not registered for event
          if (logged_in_event)
          {
          view_event_html += `<br><br>
          <h2>Update Passenger Capacity or Request Ride</h2>
          <form action="/change-ride-status/${event._id}" method="post">
            <label>New passenger count not including yourself (enter 0 if you cannot give rides)</label><br>
            <input type="number" name="passengers" value="0"><br><br>
            <label>Need Ride</label><br>
            <input type="radio" name="need_ride" id="yes-ride" value="yes">
            <label for="yes-ride">Yes</label><br>
            <input type="radio" name="need_ride" id="no-ride" value="no">
            <label for="no-ride">No</label>
            <br><br>
            <input type="submit" value="Submit">
          </form>`;
          }
          view_event_html += `<br>
          <a href="/auth">Back to sign up page</a><br>
          <a href="/sign-out">Sign out</a>
          </body>
          </html>`;
          //console.log(view_event_html);
          res.send(view_event_html);
          }
        });
      }
    })
  }
  else
    res.sendFile(__dirname + "/login.html");
})

app.get("/login", (req, res) => {
  //if already logged in, redirect to auth
  if('ufid' in req.session)
    //res.sendFile(__dirname + "/logged_in.html");
    res.redirect("/auth");
  else
    res.sendFile(__dirname + "/login.html");
})

app.get("/register", (req, res) => {
  if('ufid' in req.session)
    res.redirect("/auth");
  else
    res.sendFile(__dirname + "/signup.html");
})

app.all("/auth", (req, res) => {
  if('ufid' in req.session)
  {
    //res.sendFile(__dirname + "/logged_in.html");
    let logged_in_html = `<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <h1>Welcome!</h1><br>
            <style>
                td {
                    padding: 0 50px;
                }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <th>Event Name</th>
                    <th>Date and Time</th>
                    <th>Number Signed Up</th>
                    <th>Capacity</th>
                    <th>Join/Cancel</th>
                    <th>View Roster</th>
                </tr>`;
              
    //need to find user first
    Account.findOne({ufid: req.session.ufid}, (err, user) => {
      if (err)
        console.error(err);
      //get a list of event ids
      Event.find({}, function(err, events) {
        for (let i = 0; i < events.length; i++)
        {
          let join_string = "Join";
          let join_route = "join_event"
          for (let j = 0; j < events[i].signed_up_users.length; j++)
            if (JSON.stringify(user) == JSON.stringify(events[i].signed_up_users[j].user_object))
            {
              join_string = "Cancel";
              join_route = "leave_event";
            }
          //if (user._id in event.signed_up_users)
            //join_string = "Cancel";
          logged_in_html += `<tr><td>${events[i].name}</td>
          <td>${events[i].date}</td>
          <td>${events[i].signed_up_users.length}</td>
          <td>${events[i].capacity}</td>
          <td><a href="/${join_route}/${events[i]._id}">${join_string}</a></td>
          <td><a href="/view_event/${events[i]._id}">View</a></td></tr>`;
        }
        logged_in_html += `</table><br>
        <a href="/sign-out">Sign out</a>
        </body>
        </html>`;
        res.send(logged_in_html);
      });
    });
  }
  else
    findUser(req.body.ufid, req, res);
});

app.post("/registration-submit", (req, res) => {
  if('ufid' in req.session)
    res.redirect("/auth");
  else
    addAccount((arg1, arg2) => {
      if (arg1 != null)
      {
        console.error(arg1);
        res.sendFile(__dirname + "/registration_error.html");
      }
      else
      res.sendFile(__dirname + "/login.html");
    }, req.body.ufid, req.body.name, req.body.phone, req.body.email);
})

app.get("/sign-out", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
  //res.sendFile(__dirname + "/login.html");
})

app.post("/change-ride-status/:eventid", (req, res) => {
  if('ufid' in req.session)
  {
    //find the right event
    Event.findById(req.params.eventid, (err, event) => {
      if (err)
        console.error(err);
      //find the logged-in user
      Account.findOne({ufid: req.session.ufid}, (err, user) => {
        if (err)
          console.error(err);

        //delete old user from the array
        for (let i = 0; i < event.signed_up_users.length; i++)
        if (JSON.stringify(user) == JSON.stringify(event.signed_up_users[i].user_object))
        {
          event.signed_up_users.splice(i, 1);
          i--;
        }
        
        //create new element for events list and add to array
        console.log(req.body.need_ride);
        let need_ride = (req.body.need_ride=="yes");
        event.signed_up_users.push({user_object: user,
        needs_ride: need_ride,
        passengers: req.body.passengers});



        //save new list
        event.save((err, newEvent) => {
          if (err)
            console.error(err);
        });

        //redirect
        res.redirect("/view_event/" + req.params.eventid);
      });
      
    });
    
    
  }
  else
    res.sendFile(__dirname + "/login.html");
})

app.listen(process.env.PORT || 9001);

module.exports = app;