const cors = require('cors');
var app = require('express')();
var http = require('http').createServer(app);
const { v4: uuid } = require('uuid');
const PORT = 8080;
var io = require('socket.io')(http, {cors: {origin: '*'}});

app.use(cors());

var CHANNELS = new Map();
var ROYAL = new Map();

http.listen(PORT, () => {
    console.log(`listening on port:${PORT}`);
});

io.on('connection', (socket) => {
    socket.emit('connection', null);
    console.log("new client connected");
    //if user is alone create new channel
    //if another user is waiting join the user
    socket.on('join', (id, username, mode, callback) => {
        console.log(mode);
        if(mode === "royal"){
            callback(
                royal(id, username)
            );
        }
        else {
            callback(
                single(id, username)
            );
        }  
    });

    function single(id, username){
        console.log(username);
        console.log(id);
        console.log(CHANNELS.size);
        if(CHANNELS.size <= 0) {
            //Create new channel
            var roomId = uuid();
            CHANNELS.set(roomId, {room: roomId, status: "waiting", sockets: [socket.id], names:[username], choices: [null,null], results: [], reset:[null]});
            //After join send channel number to front, when recieving from user chack if user is in channel (is someone change channel in front)
            console.log("first");
            console.log(CHANNELS.get(roomId).sockets);
            return {'id': roomId, 'names': ""};

        } else if (CHANNELS.size > 0) {
            var status = "notFound"
            var roomId;
            console.log("VALUeS");
            for(const channel of CHANNELS.values()){
                if(channel.status === "waiting"){
                    channel.status = "full";
                    channel.sockets.push(socket.id);
                    channel.reset.push(null);
                    channel.names.push(username);
                    status = "found";
                    roomId = channel.room;
                    console.log(CHANNELS.values());
                    io.to(channel.sockets[0]).emit('player-join', username);
                    return {'id': roomId, 'names': channel.names[0]};
                }
            }
            if(status === "notFound"){
                roomId = uuid();
                CHANNELS.set(roomId, {room: roomId, status: "waiting", sockets: [socket.id], names:[username], choices: [null,null], results: [], reset:[null]});
                console.log("first");
                return {'id': roomId, 'names': ""};
            }
            console.log(CHANNELS.values());
        }
    }

    function royal(id, username){
        console.log(username);
        console.log(id);
        console.log(ROYAL.size);
        if(ROYAL.size <= 0) {
            //Create new channel
            var roomId = uuid();
            ROYAL.set(roomId, {room: roomId, status: "waiting", sockets: [socket.id], playing: [socket.id], names:[username], choices: [null], results: [], round: 0, eliminated: [], eliminatedSockets: [], reset:[null]});
            //After join send channel number to front, when recieving from user chack if user is in channel (is someone change channel in front)
            console.log("first");
            console.log(ROYAL.get(roomId).sockets);
            return {'id': roomId, 'names': ""};

        } else if (ROYAL.size > 0) {
            var status = "notFound"
            var roomId;
            console.log("VALUeS");
            for(const channel of ROYAL.values()){
                if(channel.status === "waiting"){
                    if(channel.sockets.length >= 10){
                        //if more than 10 players
                        channel.status = "full";
                    }
                    channel.sockets.push(socket.id);
                    channel.playing.push(socket.id);
                    channel.choices.push(null);
                    channel.reset.push(null);
                    channel.names.push(username);
                    status = "found";
                    roomId = channel.room;
                    console.log(ROYAL.values());
                    var otherPlayerNames;
                    //send also player count
                    channel.sockets.forEach(element => {
                        //DO NOT SEND YOUR OWN USERNAME
                        var index = ROYAL.get(roomId).sockets.indexOf(element);
                        console.log("NAMES");
                        console.log(ROYAL.get(roomId).choices);
                        otherPlayerNames = ROYAL.get(roomId).names.slice();
                        console.log(otherPlayerNames);
                        if(index === otherPlayerNames.length){
                            otherPlayerNames = otherPlayerNames.pop();
                        }
                        else {
                            console.log("INDEX");
                            console.log(index);
                            otherPlayerNames.splice(index,1);
                            console.log(otherPlayerNames);
                        }
                        io.to(element).emit('player-count', channel.sockets.length - 1, otherPlayerNames);
                    });
                    return {'id': roomId, 'names': otherPlayerNames};
                }
            }
            if(status === "notFound"){
                roomId = uuid();
                ROYAL.set(roomId, {room: roomId, status: "waiting", sockets: [socket.id], playing:[socket.id], names:[username], choices: [], results: [], round: 0, eliminated: [], eliminatedSockets: [],reset:[null]});
                console.log("first");
                return {'id': roomId, 'names': ""};
            }
            console.log(ROYAL.values());
        }
    }

    socket.on('choice', (id, choice, roomId) => {
        console.log("CHOICE");
        console.log(roomId);
        if(CHANNELS.size > 0 && CHANNELS.get(roomId).sockets.indexOf(id) !== -1){
            console.log(CHANNELS.get(roomId).choices);
            let index = CHANNELS.get(roomId).sockets.indexOf(id);
            //let index = CHANNELS[0].sockets.indexOf(id);
            CHANNELS.get(roomId).choices.splice(index, 1, choice);
            //CHANNELS[0].choices.splice(index,1,choice);
            if(CHANNELS.get(roomId).choices[0] !== null && CHANNELS.get(roomId).choices[1] !== null){
                console.log(CHANNELS.get(roomId).choices);
                winner(CHANNELS.get(roomId).choices[0], CHANNELS.get(roomId).choices[1], roomId);
                io.to(CHANNELS.get(roomId).sockets[0]).emit('oponent-choice', CHANNELS.get(roomId).choices[1], CHANNELS.get(roomId).results[0]);
                io.to(CHANNELS.get(roomId).sockets[1]).emit('oponent-choice', CHANNELS.get(roomId).choices[0], CHANNELS.get(roomId).results[1]);
            }
        }

        if(ROYAL.size > 0 && ROYAL.get(roomId).playing.indexOf(id) !== -1) {
            console.log("royal");
            let index = ROYAL.get(roomId).playing.indexOf(id);
            ROYAL.get(roomId).choices[index] = choice;
            //GET INDEX OF ID WITH SOCKET
            if(ROYAL.get(roomId).playing.length == ROYAL.get(roomId).choices.length && ROYAL.get(roomId).choices.indexOf(null) === -1){
                //CHALCULATE WINNER
                console.log("CALCULATE");
                royalWinner(roomId);
                //SEND RESPONSES
                ROYAL.get(roomId).sockets.forEach(element => {
                    var index = ROYAL.get(roomId).sockets.indexOf(element);
                    console.log("CHOICES");
                    console.log(ROYAL.get(roomId).choices);
                    var otherPlayerChoices = ROYAL.get(roomId).choices.slice();
                    var otherEliminations = ROYAL.get(roomId).eliminated.slice();
                    console.log(otherPlayerChoices);
                    console.log(otherEliminations);
                    if(ROYAL.get(roomId).playing.indexOf(element) !== -1){
                        otherEliminations.splice(index, 1);
                        if(index === otherPlayerChoices.length){
                            otherPlayerChoices = otherPlayerChoices.pop();
                        }
                        else{
                            console.log("INDEX");
                            console.log(index);
                            otherPlayerChoices.splice(index,1);
                            console.log(otherPlayerChoices);
                        }
                    }
                    io.to(element).emit('oponent-choice', otherPlayerChoices, ROYAL.get(roomId).results[index], otherEliminations);
                });
            }
        }
    });

    socket.on('reset', (id, roomId) => {
        //check if royal or 1v1
        if(CHANNELS.size > 0 && CHANNELS.indexOf(roomId) != -1){
            CHANNELS.get(roomId).reset[CHANNELS.get(roomId).sockets.indexOf(id)] = true;
            var resetCount = 0;
            for(const reset of CHANNELS.get(roomId).reset){
                if(reset) resetCount++;
            }
            if(resetCount > 1){
                io.emit('reset');
                CHANNELS.get(roomId).choices[null,null];
                CHANNELS.get(roomId).results = [];
                CHANNELS.get(roomId).reset = [null,null];
            }
        }
        if(ROYAL.size > 0 && ROYAL.indexOf(roomId) != -1){

        }
        CHANNELS.get(roomId).choices = [null, null];
        //CHANNELS[0].choices = [null, null];
        CHANNELS.get(roomId).results = [];
        //CHANNELS[0].results = [];
        if(CHANNELS.get(roomId).reset.indexOf(id) == -1){
            CHANNELS.get(roomId).reset.push(id);
            if(CHANNELS.get(roomId).reset.length > 1){
                io.emit('reset');
                CHANNELS.get(roomId).reset = [];
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(socket.id);
        //remove only player
        //if no players in room then delete room
        for(const channel of CHANNELS.values()){
            if(channel.sockets.indexOf(socket.id) !== -1){
                //Remove choice
                CHANNELS.get(channel.room).choices.splice(channel.sockets.indexOf(socket.id),1);
                //Remove result
                CHANNELS.get(channel.room).results.splice(channel.sockets.indexOf(socket.id),1);
                //Remove player
                CHANNELS.get(channel.room).sockets.splice(channel.sockets.indexOf(socket.id),1);
                //IF ROOM IS EMPTY REMOVE ROOM
                if(channel.sockets.length <= 0) {
                    CHANNELS.delete(channel.room);
                }
                console.log(CHANNELS.size);
                console.log("disconnect");
            }
        }
        //REMOVE PLAYER AND NOT THE WHOLE ROOM
        for(const royal of ROYAL.values()){
            if(royal.sockets.indexOf(socket.id) !== -1){
                //remove user socket ID
                //remove choice of the index of uses deisconected
                //send update to all other users
                //Remove choice
                ROYAL.get(royal.room).choices.splice(royal.sockets.indexOf(socket.id),1);
                //Remove result
                ROYAL.get(royal.room).results.splice(royal.sockets.indexOf(socket.id),1);
                //Remove player
                ROYAL.get(royal.room).sockets.splice(royal.sockets.indexOf(socket.id),1);
                //Remove Username
                ROYAL.get(royal.room).names.splice(royal.sockets.indexOf(socket.id), 1);
                var otherPlayerNames;
                console.log(ROYAL.get(royal.room).names);
                ROYAL.get(royal.room).sockets.forEach(element => {
                    var index = ROYAL.get(royal.room).sockets.indexOf(element);
                    otherPlayerNames = ROYAL.get(royal.room).names.slice();
                    if(index === otherPlayerNames.length){
                        otherPlayerNames = otherPlayerNames.pop();
                        console.log(otherPlayerNames);
                    }
                    else {
                        otherPlayerNames.splice(index,1);
                        console.log(otherPlayerNames);
                    }
                    //send to all new amount of players
                    io.to(element).emit('player-count', royal.sockets.length - 1, otherPlayerNames);
                });
                console.log(royal.sockets.length);
                console.log("disconnect");
                //IF ROOM IS EMPTY REMOVE ROOM
                if(royal.sockets.length <= 0) {
                    ROYAL.delete(royal.room);
                }
            }
        }
    });

    let winner = ((p1,p2, roomId) => {
        if((p1+1)%3 == p2){
            //p2 won
            CHANNELS.get(roomId).results.push(0);
            CHANNELS.get(roomId).results.push(1);
        } else if(p1 == p2){
            //draw
            CHANNELS.get(roomId).results.push(2);
            CHANNELS.get(roomId).results.push(2);
        } else {
            //p1 won
            CHANNELS.get(roomId).results.push(1);
            CHANNELS.get(roomId).results.push(0);
        }
    });

    let royalWinner = ((roomId) => {
        var differentChoices = [];
        ROYAL.get(roomId).choices.forEach(element => {
            if(differentChoices.indexOf(element) === -1){
                differentChoices.push(element);
            }
        });
        console.log(differentChoices);
        console.log(differentChoices.length);
        if(differentChoices.length == 2){
            console.log("win");
            console.log(ROYAL.get(roomId).results);
            let playerIndex = 0;
            let winningPlayers = 0;
            ROYAL.get(roomId).choices.forEach(element => {
                //p2 won
                if((differentChoices[0]+1)%3 == differentChoices[1]){
                    if(element == differentChoices[0]){
                        ROYAL.get(roomId).results.push(0);
                        ROYAL.get(roomId).eliminated.push("eliminated");
                        ROYAL.get(roomId).eliminatedSockets.push(ROYAL.get(roomId).sockets[playerIndex]);
                    }
                    else {
                        ROYAL.get(roomId).results.push(1);
                        ROYAL.get(roomId).eliminated.push("playing");
                        winningPlayers++;
                    }
                }
                else {
                    if(element == differentChoices[0]){
                        ROYAL.get(roomId).results.push(1);
                        ROYAL.get(roomId).eliminated.push("playing");
                        winningPlayers++;
                    }
                    else {
                        ROYAL.get(roomId).results.push(0);
                        ROYAL.get(roomId).eliminated.push("eliminated");
                        ROYAL.get(roomId).eliminatedSockets.push(ROYAL.get(roomId).sockets[playerIndex]);
                    }
                }
                playerIndex++;
            });
            console.log("results");
            console.log(ROYAL.get(roomId).results);
        }
        else{
            ROYAL.get(roomId).results = new Array(ROYAL.get(roomId).sockets.length).fill(2);
        }
    });

});