
app.AudioController = {

  // playlist defaults
  playlistId: 0, // 0 = audio

  currentPlaylist: {
    'items': [],
    'status': 'none'
  }

};


/**
 * Refresh the playlist
 * @param callback
 */
app.AudioController.playlistRefresh = function(callback){

  // xbmc playlist
  app.AudioController.getPlaylistItems(function(result){

    //cache
    app.cached.xbmcPlaylist = result.items;

    //create a new playlist view and render
    app.playlistView = new app.PlaylistView({model:{models:result.items}});
    $('.sidebar-items').html(app.playlistView.render().el);

    app.AudioController.getNowPlaying(function(data){

      //update shell to now playing info
      app.shellView.updateState(data);
      //rebind controls to playlist after refresh
      app.playlistView.playlistBinds(this);
    });

    if(app.helpers.exists(callback)){
      callback(result);
    }

  });

};




/**
 * Adds an artist/album/song to the playlist
 * @param type
 *  eg. artistid, albumid, songid
 * @param id
 *  value of type
 *
 */
app.AudioController.playlistAdd = function(type, id, callback){

  var filter = {};
  filter[type] = id;

  //add the album to the playlist
  app.xbmcController.command('Playlist.Add', [app.AudioController.playlistId,filter], function(data){

    //get playlist items
    app.AudioController.getPlaylistItems(function(result){

      //update cache
      app.AudioController.currentPlaylist = result;

      callback(result);

    })
  });

};


/**
 * Adds multiple artist/album/song to the playlist
 * @param type
 *  eg. artistid, albumid, songid
 * @param id
 *  value of type
 *
 */
app.AudioController.playlistAddMultiple = function(type, ids, callback){

  var commands = [],  id;
  for(n in ids){
    param = {};
    id = ids[n];
    // used only for songs, switches between file and id depending on var type
    if(type == 'mixed'){
      type = (typeof id == 'number' ? 'songid' : 'file');
    }
    param[type] = id;
    commands.push({method: 'Playlist.Add', params: [app.AudioController.playlistId,param]});
  }

  //add the album to the playlist
  app.xbmcController.multipleCommand(commands, function(data){

    //get playlist items
    app.AudioController.getPlaylistItems(function(result){

      //update cache
      app.AudioController.currentPlaylist = result;

      callback(result);

    })
  });

};


/**
 * Swap the position of an item in the playlist
 *
 * This moves an item from one position to another
 * It does this by cloning pos1, remove original pos, insert pos1 clone into pos2
 * Not to be confused with xbmc playlist.swap which is fairly useless IMO
 *
 * @param pos1
 *  current playlist position
 * @param pos2
 *  new playlist position
 */
app.AudioController.playlistSwap = function(pos1, pos2, callback){
  console.log(pos1, pos2);
  //get playlist items
  app.AudioController.getPlaylistItems(function(result){
    //clone for insert
    var clone = result.items[pos1],
      insert = {};
    //if songid found use that as a preference
    console.log(clone);
    if(clone.id != undefined && typeof clone.id == 'number'){
      insert.songid = clone.id;
    } else { //use filepath if no songid
      insert.file = clone.file;
    }
    //remove the original
    app.AudioController.removePlaylistPosition(pos1, function(result){
      //insert the clone
      app.xbmcController.command('Playlist.Insert', [app.AudioController.playlistId,pos2,insert], function(data){
        //get playlist items
        app.AudioController.getPlaylistItems(function(result){
          //update cache
          app.AudioController.currentPlaylist = result;
          callback(result);

        })
      });
    });

  })
};



/**
 * Clear then adds an artist/album/song to the playlist
 * @param type
 *  eg. artistid, albumid, songid
 * @param id
 *  value of type
 *
 */
app.AudioController.playlistClearAdd = function(type, id, callback){

  // clear playlist
  app.xbmcController.command('Playlist.Clear', [app.AudioController.playlistId], function(data){
    app.notification('Playlist Cleared');
    app.AudioController.playlistAdd(type, id, callback);
  });

};


/**
 * Clear the playlist
 */
app.AudioController.playlistClear = function(callback){
  // clear playlist
  app.xbmcController.command('Playlist.Clear', [app.AudioController.playlistId], function(data){
    if(callback){
      callback(data);
    }
  });
};


/**
 * Adds an an artist/album/song to the playlist then starts playing
 * @param playSongId
 *  song to play
 * @param type
 *  eg. artistid, albumid, songid
 * @param id
 *  value of type
 *
 */
app.AudioController.playlistPlaySongId = function(playSongId, callback){

    //@TODO: fix below to be nicer

    //find the song and play it
    var playing = false;
    $.each(app.AudioController.currentPlaylist.items, function(i,d){
      //matching song!
      if(d.id == playSongId && playing === false){
        app.AudioController.playPlaylistPosition(i, function(data){
          //update playlist
          app.AudioController.playlistRefresh();
          //notify
          app.notification('Now playing "' + d.label + '"');
        });
        playing = true;
      }
    });

};





/**
 * Play Song
 */
app.AudioController.playSongById = function(songid, type, id, clearList){

  if(app.helpers.exists(clearList) && clearList === true){
    // clear playlist first
    app.AudioController.playlistClearAdd( type, id, function(result){
      app.AudioController.playlistPlaySongId(songid);
    });
  } else {
    //just add
    app.AudioController.playlistAdd( type, id, function(result){
      app.AudioController.playlistPlaySongId(songid);
    });
  }

};


/**
 * Inserts a song in the playlist next and starts playing that song
 */
app.AudioController.insertAndPlaySong = function(type, id, callback){

  var player = app.cached.nowPlaying.player,
      playingPos = (typeof player.position != 'undefined' ? player.position : 0),
      pos = playingPos + 1,
      insert = {};

  insert[type] = id;

  // if nothing is playing, we will clear the playlist first
  if(app.cached.nowPlaying.status == 'notPlaying'){
    // clear
    app.AudioController.playlistClear(function(){
      // insert
      app.xbmcController.command('Playlist.Insert', [app.AudioController.playlistId,pos,insert], function(data){
        // play
        app.AudioController.playPlaylistPosition(pos, function(){
          if(callback){
            callback(data);
          }
        });
      });
    })
  } else {
    // playing, insert
    app.xbmcController.command('Playlist.Insert', [app.AudioController.playlistId,pos,insert], function(data){
      // play
      app.AudioController.playPlaylistPosition(pos, function(){
        if(callback){
          callback(data);
        }
      });
    });
  }

};



app.AudioController.songLoadMultiple = function(songids, callback){

    // vars
    var commands = [];

    // create commands
    for(n in songids){
      var sid = songids[n];
      if(typeof sid == 'number'){
        // it is a song and sid should be a songid
        commands.push({
          method: 'AudioLibrary.GetSongDetails',
          params: [sid, app.songFields ]
        });
      } else {

        // for a file add defaults
        var defaults = {
            position: n,
            songid: 'file',
            album: '',
            artist: '',
            duration: 0
          },
          item = $.extend(defaults, songids[n]);
        item.id = songids[n].file;

        songids[n] = item;
      }

    }

    //if songs to get
    if(commands.length > 0){

      // load all song data
      app.xbmcController.multipleCommand(commands, function(res){

        // parse each result into an array of song objects (models)
        var dict = {}, payload = [];
        _.each(res, function(r){
          if(typeof r.result != 'undefined'){
            dict[r.result.songdetails.songid] = r.result.songdetails;
          }
        });

        // add songs back in their correct order using a dictionary
        for(n in songids){
          var sid = songids[n];
          if(typeof sid == 'number' && typeof dict[sid] != 'undefined'){
            songids[n] = dict[sid];
          }
        }

        // lastly, we clean up the output and ensure every item is an object
        // we also assign final position in the list
        var p = 0;
        for(n in songids){
          var item = songids[n];
          if(typeof item == 'object'){
            item.position = p;
            payload.push(item);
            p++;
          }
        }

        // callback
        callback(payload);
      });

    } else {
      // all files
      callback(songids);
    }


};

/**
 * Gets a download url for a file
 * @param file
 * @param callback
 */
app.AudioController.downloadFile = function(file, callback){
  app.xbmcController.command('Files.PrepareDownload', [ file ], function(result){
    if(callback){
      callback(result.result.details.path);
    }
  });
};



/**
 * Adds an album to the playlist and starts playing the given songid
 * @param songid
 * @param albumid
 */
/*app.AudioController.playSongInAlbum = function(songid, albumid){


  app.AudioController.playlistAdd('albumid', albumid, function(result){

    //find the song and play it
    var playing = false;
    $.each(app.AudioController.currentPlaylist.items, function(i,d){
      //matching song!
      if(d.id == songid && playing === false){
        app.AudioController.playPlaylistPosition(i, function(data){
          //update playlist
          app.AudioController.playlistRefresh();
          //notify
          app.notification('Now playing "' + d.label + '"');
        });
        playing = true;
      }
    });

  });

};*/


/**
 * Generic player command with to callback required
 */
app.AudioController.sendPlayerCommand = function(command, param){
  app.xbmcController.command(command, [ app.cached.nowPlaying.activePlayer, param], function(result){
    app.AudioController.updatePlayerState();
  });
};

/**
 * Play something from playlist
 */
app.AudioController.playPlaylistPosition = function(position, callback ){
  app.xbmcController.command('Player.Open', [{"playlistid": app.AudioController.playlistId,"position":position}], function(result){
    callback(result.result); // return items
  });
};


/**
 * Remove something from playlist
 */
app.AudioController.removePlaylistPosition = function(position, callback ){
  app.xbmcController.command('Playlist.Remove', [app.AudioController.playlistId,position], function(result){
    callback(result.result); // return items
  });
};



/**
 * Seek curently playing to a percentage
 */
app.AudioController.seek = function(position, callback ){
  app.xbmcController.command('Player.Seek', [app.AudioController.playlistId, position], function(result){
    if(app.helpers.exists(callback)){
      callback(result.result); // return items
    }
  });
};

/**
 * Get items from playlist
 */
app.AudioController.getPlaylistItems = function(callback){
  app.xbmcController.command('Playlist.GetItems',
    [
      app.AudioController.playlistId,
      ['albumid', 'artistid', 'thumbnail', 'file', 'duration', 'year', 'album']
    ], function(result){
    callback(result.result); // return items
  });
};



/**
 * Set Volume
 */
app.AudioController.setVolume = function(val){
  app.xbmcController.command('Application.SetVolume', [val], function(data){
    //volume set
    //app.AudioController.updatePlayerState();
  });
};


/**
 * Library Scan
 */
app.AudioController.audioLibraryScan = function(){

  app.xbmcController.command('AudioLibrary.Scan', [], function(data){

  });

};


/**
 * Get now playing
 */

app.AudioController.getNowPlaying = function(callback){

  var fields = {
    item: ["title", "artist", "artistid", "album", "albumid", "genre", "track", "duration", "year", "rating", "playcount", "albumartist", "file", "thumbnail", "fanart"],
    player: [ "playlistid", "speed", "position", "totaltime", "time", "percentage", "shuffled", "repeat", "canrepeat", "canshuffle", "canseek" ]
  };
  var ret = {'status':'notPlaying', 'item': {}, 'player': {}, 'activePlayer': 0, 'volume': 0}, commands = [];

  // first commands to run
  commands = [
    {method: 'Application.GetProperties', params: [["volume", "muted"]]},
    {method: 'Player.GetActivePlayers', params: []}
  ];

  // first run
  app.xbmcController.multipleCommand(commands, function(data){

    var properties = data[0], players = data[1];

    // set some values
    ret.volume = properties.result;
    app.AudioController.activePlayers = players.result;

    if(players.result.length > 0){
      //something is playing
      ret.activePlayer = players.result[0].playerid;

      // second run commands
      commands = [
        {method: 'Player.GetItem', params: [ret.activePlayer, fields.item]},
        {method: 'Player.GetProperties', params: [ret.activePlayer, fields.player]}
      ];

      // run second lot
      app.xbmcController.multipleCommand(commands, function(item){
        // get data
        ret.item = item[0].result.item;
        ret.player = item[1].result;
        ret.status = 'playing';

        // set cache
        app.cached.nowPlaying = ret;

        // callback
        if(callback){
          callback(ret);
        }

      });

    } else {

      //nothing playing
      app.cached.nowPlaying = ret;
      callback(ret);

    }


  });







  app.xbmcController.command('Application.GetProperties', [["volume", "muted"]], function(properties){
    //get volume level
    ret.volume = properties.result;
    app.xbmcController.command('Player.GetActivePlayers', [], function(players){

      app.AudioController.activePlayers = players.result;

      if(players.result.length > 0){
        //something is playing
        ret.activePlayer = players.result[0].playerid;
        app.xbmcController.command('Player.GetItem', [ret.activePlayer, fields.item], function(item){
          ret.item = item.result.item;
          ret.status = 'playing';

          app.xbmcController.command('Player.GetProperties', [ret.activePlayer, fields.player], function(player){
            ret.player = player.result;
            app.cached.nowPlaying = ret;
            callback(ret);
          });

        });
      } else {
        //nothing playing
        app.cached.nowPlaying = ret;
        callback(ret);
      }

    });

  });



};

/**
 * Kick off a refresh of playing state
 */
var stateTimeout = {};
app.AudioController.updatePlayerState = function(){
  //clearTimeout(stateTimeout);
  app.AudioController.getNowPlaying(function(data){
    app.shellView.updateState(data);
    //stateTimeout = setTimeout(app.AudioController.updatePlayerState, 5000);
  });
};