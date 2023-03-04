import { parseWorkout } from './parser/parser.js'
import express from 'express'
import axios from 'axios'

const app = express()
const port = 3000

app.set('title', 'Strava Workout Parser')
app.set('views', './views')
app.set('view engine', 'pug')
app.listen(port, function() {
    console.log(`App started, listening on port ${port}`)
})

//
//
// App routes
//
//

const stravaAuthTokenURL = "https://www.strava.com/oauth/token"

const initialGrantType = "authorization_code"
const refreshGrantType = "refresh_token"

app.get("/", function(req, res) {
    res.render('index', {
        title: "Workout Parser Login", 
        bodyMessage: "Log in to Workout Parser"
    })
})

app.get("/oauth_redirect", (req, res) => {
    const code = req.query.code
    axios({
        method: "post",
        url: `${stravaAuthTokenURL}?client_id=${clientID}&client_secret=${clientSecret}&grant_type=${initialGrantType}&code=${code}`,
        headers: "application/json"
    }).then((authRes) => {
        const athleteID = authRes.data.athlete.id
        const accessToken = authRes.data.access_token
        createNewUser(athleteID, accessToken)

        res.redirect("/login_home")
    })
})

app.get("/login_home", (req, res) => {
    res.render('login_home', {
        title: "Workout Parser", 
        bodyMessage: "Welcome to Workout Parser"
    })
})

app.get("/parse_activity", (req, res) => {
    let activityID = req.query.activityID
    console.log(activityID)
    getActivity(activityID, getTokenForID(storedID), (run) => {
        let output = parseWorkout(run)
        res.render('parsed_workout', {
            title: "my run",
            body: output
        })
    })
})


//
//
// Strava API
//
//

function refreshAccessToken(refreshToken) {
    axios({
        method: "post",
        url: `${stravaAuthTokenURL}?client_id=${clientID}&client_secret=${clientSecret}&grant_type=${refreshGrantType}&refresh_token=${refreshToken}`,
        headers: "application/json"
    }).then((res) => {
        // const accessToken = res.data.access_token
        console.log(res.data)
    })
}

const apiBase = "https://www.strava.com/api/v3"

function getActivity(activityID, accessToken, callback) {
    console.log(`     Getting ${activityID} with ${accessToken}`)

    const config = {
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`}
    };

    axios.get(`${apiBase}/activities/${activityID}`, config)
        .then((res) => {
            callback(res.data)
        })
}


//
//
// DB Functions
//
//

var storedAccessToken
var storedID

function createNewUser(id, accessToken) {
    storedAccessToken = accessToken
    storedID = id

    console.log(`Created new user with ID: ${id}`)
}

function getTokenForID(id) {
    if (id === storedID) {
        return storedAccessToken
    }
}