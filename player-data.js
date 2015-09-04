/*
 * Projections CSV File Format:
 * id,last,first,pos,pos1,team,patt,pcmp,pyds,p300,ptds,pint,ratt,ryds,r100,rtds,rec,cyds,c100,ctds,fum,FGM,FGA,EPM,EPA,TD,FF,FR,INT,Sack,Saf,yds,pts,iInt,iPD,iTck,iAst,iSack,iFF,iFR,iTD,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,GP,age,exp,kryd,krtd,pryd,prtd
 *
 * ADP CSV File Format:
 * lname,fname,pos,team,adp_consensus,adp_expert,adp_mfl,adp_mock,adp_cbs,adp_mag,adp_consensus_ppr,adp_expert_ppr,adp_mfl_ppr,adp_mock_ppr
 *
 * DEF PTS/Game Equation: f(x) = -0.372x + 7.76
 */

var parse = require('csv/node_modules/csv-parse');
var fs = require('fs');

var results = [];
var adpSorted = [];
var lock = 1;
function Result(pos, name, team, total) {
    this.pos = pos;
    this.name = name;
    this.team = team;
    this.total = parseFloat(total).toFixed(2);
    this.adp = 1000;
};
Result.prototype.setAdp = function setAdp(adp) {
    this.adp = adp;
};
Result.prototype.setTotal = function setTotal(total) {
    this.total = total.toFixed(2);
};

var totalSort = function(a, b){
    return b.total - a.total;
};

var adpSort = function(a, b){
    return a.adp - b.adp;
};

function getParser() {
return parse({delimiter: '\t', columns: true, auto_parse: true}, function(err, data) {
    for (var i in data) {
        var item = data[i];

        var pos = item['pos'];
        var total;
        if (pos === 'K') {
            total =
                (item['fg'] * 3)
                + ((item['fga'] - item['fg']) * -1)
                + (item['xpt'] * 1);
        } else if (pos === 'QB') {
            total =
                (item['pass_yds'] / 25)
                + (item['pass_tds'] * 6)
                + (item['pass_ints'] * -2)
                + (item['rush_yds'] / 10)
                + (item['rush_tds'] * 6);
        } else if (pos === 'RB' || pos === 'WR') {
            total =
                (item['rush_yds'] / 10)
                + (item['rush_tds'] * 6)
                + (item['rec_att'] * .5)
                + (item['rec_yds'] / 10)
                + (item['rec_tds'] * 6)
                + (item['fumbles'] * -2);
        } else if (pos === 'TE') {
            total =
                (item['rec_att'] * .5)
                + (item['rec_yds'] / 10)
                + (item['rec_tds'] * 6)
                + (item['fumbles'] * -2);
        }
        results[pos] = results[pos] || [];

        var result = new Result(pos, item['name'], item['team'], total);
        results[pos].push(result);
        if (pos == 'RB' || pos == 'WR') {
            results['FLEXRW'] = results['FLEXRW'] || [];
            results['FLEXRW'].push(result);
        }
        if (pos == 'WR' || pos == 'TE') {
            results['FLEXWT'] = results['FLEXWT'] || [];
            results['FLEXWT'].push(result);
        }
    };

    for (var pos in results) {
        results[pos].sort(totalSort);
    };

    var adpParser = parse({delimiter: '\t', columns: true, auto_parse: true}, function(err, data) {
        if (lock == 1) {
            lock++;
        var setAdpForPlayer = function(player, adp) {
            for (var pos in results) {
                for (var i in results[pos]) {
                    if (results[pos][i].name === player) {
                        results[pos][i].setAdp(adp);
                        return results[pos][i];
                    }
                }
            }
        };

        for (var i in data) {
            var item = data[i];

            var player = item['name'];
            var adp = item['adp'] || 1000;
            adpSorted.push(setAdpForPlayer(player, adp));
        };
        adpSorted.sort(adpSort);
        }
    });
    fs.createReadStream(__dirname + '/data/adp.csv').pipe(adpParser);
});
}


fs.createReadStream(__dirname + '/data/qb.csv').pipe(getParser());
fs.createReadStream(__dirname + '/data/rb.csv').pipe(getParser());
fs.createReadStream(__dirname + '/data/wr.csv').pipe(getParser());
fs.createReadStream(__dirname + '/data/te.csv').pipe(getParser());
fs.createReadStream(__dirname + '/data/k.csv').pipe(getParser());


var bestAvailable = function bestAvailable(picks) {
    function ResultEntry(position, delta, string) {
        this.position = position;
        this.delta = delta.toFixed(2);
        this.string = string;
    }
    var result = [];
    var adp = adpSorted[picks]['adp'];

    var nextBest = [];
    for (var pos in results) {
        for (var i in results[pos]) {
            if (results[pos][i].adp > adp) {
                nextBest[pos] = results[pos][i];
                break;
            }
        }
        var delta = 0;
        var string = 'n/a';
        if (nextBest[pos]) {
            delta = (results[pos][0].total - nextBest[pos].total);
            string = results[pos][0].name
                + ' ('
                + results[pos][0].adp
                + ') vs '
                + nextBest[pos].name
                + ' ('
                + nextBest[pos].adp
                + ')';
        }

        result.push(new ResultEntry(pos, delta, string));
    }

    result.sort(function(a, b) {
        return b.delta - a.delta;
    });
    return result;
};

var allPlayers = function allPlayers() {
    var all = [];
    for (var pos in results) {
        for (var i in results[pos]) {
            if (all.indexOf(results[pos][i]) == -1) {
                all.push(results[pos][i]);
            }
        }
    }
    all.sort(adpSort);
    return all;
};

var draft = function draft(name) {
    function removePlayer(players) {
        for (var i in players) {
            if (players[i] && players[i].name === name) {
                players.splice(i, 1);
            }
        }
    };

    for (var pos in results) {
        removePlayer(results[pos]);
    }
    removePlayer(adpSorted);
};

var allByPosition = function allByPosition(position) {
    return results[position];
};

module.exports.bestAvailable = bestAvailable;
module.exports.allPlayers = allPlayers;
module.exports.draft = draft;
module.exports.allByPosition = allByPosition;
