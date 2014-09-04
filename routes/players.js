var express = require('express');
var router = express.Router();
var playerData = require('../player-data');

router.get('/', function(req, res) {
  res.render('players', {
      players: playerData.bestAvailable(req.param('picks') || 10),
      allPlayers: playerData.allPlayers(),
      allQB: playerData.allByPosition('QB'),
      allRB: playerData.allByPosition('RB'),
      allWR: playerData.allByPosition('WR'),
      allTE: playerData.allByPosition('TE'),
      allFLEXRW: playerData.allByPosition('FLEXRW'),
      allFLEXWT: playerData.allByPosition('FLEXWT'),
      allDST: playerData.allByPosition('DEF'),
      allK: playerData.allByPosition('PK')
  });
});

router.post('/', function(req, res) {
    playerData.draft(req.param('drafted'));
    res.render('players', {
        players: playerData.bestAvailable(req.param('picks') || 10),
        allPlayers: playerData.allPlayers(),
        allQB: playerData.allByPosition('QB'),
        allRB: playerData.allByPosition('RB'),
        allWR: playerData.allByPosition('WR'),
        allTE: playerData.allByPosition('TE'),
        allFLEXRW: playerData.allByPosition('FLEXRW'),
        allFLEXWT: playerData.allByPosition('FLEXWT'),
        allDST: playerData.allByPosition('DEF'),
        allK: playerData.allByPosition('PK')
    });
});

module.exports = router;
