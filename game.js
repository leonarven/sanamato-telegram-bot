const EventEmitter = require('events');

const StringInMatrice    = require( './StringInMatrice' );

const CHARS = require('./chars/fin.js')();

const whitespace_regexp = /[\s]+/g;

class Score {
	constructor( player = {} ) {
		if (typeof player == "string" || typeof player == "number") player = { id: player };

		this.player = player;
		this.id     = player.id    || null;
		this.label  = player.label || player.id || null;

		this.founds   = {};
		this.words    = [];
		this.uniques  = [];
		this.invalids = [];
	}
}

class GameAbstract extends EventEmitter {
	constructor( chat = null, cnf = {} ) {
		super();

		console.debug( "new GameAbstract( chat, cnf ) ::", arguments );

		GameAbstract.games[ chat.id ] = this;

		this.chat = chat;

		this.w = cnf.w || cnf.size || 5;
		this.h = cnf.h || cnf.size || 5;

		/** @TODO: selvitä oikean pelin merkit */
		if (!cnf.chars) cnf.chars = "FIN";
		else cnf.chars = cnf.chars.toUpperCase();

		if (CHARS[cnf.chars] && CHARS[cnf.chars].chars) cnf.chars = CHARS[cnf.chars].chars;

		this.charsArr = cnf.chars.split("").map( v => [ v ]);

		this.ctime = new Date();

		this.players = {};

		this.board = [];
		for (var row, y = 0; y < this.h; y++) {
			this.board.push( row = [] );
			for (var x = 0; x < this.w; x++) {
				var idx = (y * this.w + x) % this.charsArr.length;

				// Sallitaan matriisia lyhyempien merkistöjen uudelleenkäyttö merkkisarjojen toistumatta
				if (idx == 0) this.charsArr.sort(() => Math.random()-.5 );
				
				// Noudetaan kutakin merkkiä vastaavista merkeistä satunnainen (Not implemented! = tuloksena aina yhden pituisen tauluikon ensimmäinen alkio)
				row.push( this.charsArr[ idx ].length > 1 ? this.charsArr[ idx ][ parseInt( Math.random() * this.charsArr[ idx ].length )] : this.charsArr[ idx ][0]);
			}
		}

		this.$timeouts = [];
		if (isFinite( cnf.timeout ) && cnf.timeout > 0 && typeof cnf.timeoutFn == "function") {
			this.$timeouts.push( setTimeout( cnf.timeoutFn, 1000 * cnf.timeout, this ));

			for (var tMinus in cnf.timeoutFn.tMinus) {
				var tDelta = 1000 * (cnf.timeout - parseInt( tMinus ));
				if (typeof cnf.timeoutFn.tMinus[tMinus] == "function" && tDelta > 0) {
					this.$timeouts.push( setTimeout( cnf.timeoutFn.tMinus[tMinus], tDelta, this ));
				}
			}
		}

		console.debug( "GameAbstract() ::", this );
	}

	stop() {
		for (var timeout of this.$timeouts) clearTimeout( timeout );
		
		this.emit( 'stop' );
	}

	toString( opts = {} ) {
		return this.board.map( row => {
			return row.map( char => {
				return "" + char.toUpperCase() + "";
			}).join( "\t" );
		}).join( "\n" );
	}

	getScores() {
		return GameAbstract.getScores(this);
	}

	static getScores( game ) {
		var players = game.players;
		var scores = {};

		var all_words = {};
		var chars = [];

		game.board.forEach( row => row.forEach( char => {
			if (chars.indexOf( char ) == -1) chars.push( char );
		}));

		var chars_regexp = new RegExp( "^(["+chars.join("").toUpperCase()+"]+)$");

		console.debug( "getScores() :: regexp", chars_regexp);

		for (var id in players) {
			scores[id] = new Score( players[id] ); // { words: [], uniques: [], founds: {}, invalids: [] };

			var words = [];
			for (var msg of players[id].$msgs) {
				try {
					msg.text.trim().toUpperCase().split( whitespace_regexp ).forEach( word => {
						if (word.length >= 2 && words.indexOf(word) == -1) {
							words.push(word);
						}
					});
				} catch(e) {}
			}

			// Siivotaan pois merkkijonot joissa on merkistön ulkopuolisia merkkejä
			words = words.filter( word => {
				if (chars_regexp.test( word )) return true;
				scores[id].invalids.push( word );
			});

			// Parsitaan jäljelle vain sanat, jotka löytyvät matriisista
			for (var word of words) {
				var paths = Object.keys( StringInMatrice( word, game.board ));

				if (paths.length > 0) {
					scores[id].founds[ word ] = paths;

					if (!all_words[word]) all_words[word] = [ id ];
					else all_words[word].push( id );
				} else {
					scores[id].invalids.push( word );
				}
			}

			scores[id].words = Object.keys( scores[id].founds ).sort(( a, b ) => a.localeCompare( b, "sv" ));
		}

		console.debug( "getScores() :: all_words", all_words);

		for (var word in all_words) {
			if (all_words[word].length == 1) {
				scores[ all_words[word][0] ].uniques.push( word );
			}
		}
		
		return scores;
	}
}
GameAbstract.games = {};

module.exports = { GameAbstract, Score };
