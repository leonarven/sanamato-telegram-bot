const        TelegramBot = require( 'node-telegram-bot-api' );
const OfflineTelegramBot = require( './OfflineTelegramBot' );
const StringInMatrice    = require( './StringInMatrice' );

const Chat = OfflineTelegramBot.Chat;
const chats = {};
const games = {};

const CHARS = require('./chars-fin')();

const argv  = require('minimist')(process.argv.slice(2));
const token = argv.token;

if (!token) throw "Missing parameter --token";

const bot = new (require( argv.offline ? './OfflineTelegramBot' : 'node-telegram-bot-api' ))( token, { polling: true });


bot.on('polling_error', err => {
	console.error( "ERROR at bot.on(polling_error) ::", err );

	if (err.code == "EFATAL") {
		console.error( "Got EFATAL error. Exiting" );
		process.exit();
	}
});

bot.on('text', msg => {
	const chatId = msg.chat && msg.chat.id || null;

	if (chatId) {
		if (!chats[ chatId ]) chats[ chatId ] = new Chat( chatId, msg.chat );

		const game = games[ chatId ];
		if (game) {
			console.debug( "bot.on('text', (msg)) ::", msg );

			if (msg.from && !msg.from.is_bot) {
				if (!game.players[ msg.from.id ]) {
					game.players[ msg.from.id ] = msg.from;
					game.players[ msg.from.id ].$msgs = [];
					game.players[ msg.from.id ].label = msg.from.first_name || msg.from.username || msg.from.id;
				}
				game.players[ msg.from.id ].$msgs.push( msg );
			}
		}
	}
});



/**
 * Komennon /peli käsittely
 * /peli /^\d+/ = A-pituinen kierros
 * /peli /^\d+/ /^\d+/ = A-pituinen kierros B-kokoisella laudalla
 * /peli /^\d+/ /^\d+/ xyz = A-pituinen kierros B-kokoisella laudalla käyttäen merkistöä xyz
 *
 * @param {number} [match[1]=5]    - Käytetyn laudan koko
 * @param {number} [match[2]=null] - Kierroksen pituus
 * @param {string} [match[3]=FIN]  - Käytetty kirjaimisto tai sen koodi
 *
 *          -> CMD       |timeout   |size      |chars */
bot.onText(/^\/peli(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?\s*$/, (msg, match) => {
	console.debug( "bot.onText(\/start, ( msg, match )) :: ", msg, match );

	try {
		handleCmdPeli( msg, {
			size:    match[1] == null ? 5     : parseInt(match[1]),
			timeout: match[2] == null ? null  : parseInt(match[2]),
			chars:   match[3] == null ? "FIN" : match[3]
		});
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/start) ::", err );
		sendMessage( msg.chat.id, `Virhe komennon käsittelyssä!\n${ err }`);
	}
});



/**
 * Komennon /kisa käsittely
 * /kisa /^\d+/ = A-kokoisella laudalla järjestetty manuaalisesti lopetettava peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ = A-kokoisella laudalla järjestetty, B-pituinen peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä, B-pituisia pelejä C-kpl, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ xyz = A-kokoisella laudalla järjestettyjä merkistöä zyx käyttäviä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 *
 * @param {number} (match[1]=5)   - Käytetyn laudan koko
 * @param {number} (match[2]=120) - Kierroksen pituus, jos halutaan
 * @param {number} (match[3=1)]   - Kierrosten lukumäärä
 * @param {number} (match[4])     - Automaatiolla (jos asetettu) määritelty kierrosten välinen aika
 * @param {string} (match[5]=FIN) - Käytetty kirjaimisto tai sen koodi
 *
 *          -> CMD       |size      |timeout   |rounds    |delay     |chars */
bot.onText(/^\/kisa(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?)?)?\s*$/, (msg, match) => {
	console.debug( "bot.onText(\/kisa, ( msg, match )) :: ", msg, match );
	try {
		handleCmdKisa( msg, {
			size:    match[1] == null ? 5     : parseInt(match[1]),
			timeout: match[2] == null ? 120   : parseInt(match[2]),
			rounds:  match[3] == null ? 1     : parseInt(match[3]),
			delay:   match[4] == null ? null  : parseInt(match[4]),
			chars:   match[5] == null ? "FIN" : match[5]
		});
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/start) ::", err );
		sendMessage( msg.chat.id, `Virhe komennon käsittelyssä!\n${ err }`);
	}
});



/**
 */
bot.onText(/\/stop/, (msg, match) => {
	console.debug( "bot.onText(\/stop, ( msg, match )) :: ", msg, match );
	try {
		handleCmdStop( msg, match );
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/stop) ::", err );
	}

	function handleCmdStop( msg, match ) {
		console.debug( "handleCmdStop( msg, opts ) ::", arguments );

		const chatId = msg.chat.id;
		const game = games[ chatId ];

		if (!game) return sendMessage( chatId, "Ei peliä, joka lopettaa!", { disable_notification: true } );

		for (var timeout of game.$timeouts) clearTimeout( timeout );

		delete games[ chatId ];

		sendMessage( chatId, "Peli keskeytetty!", { disable_notification: true } );
	}
});




function sendMessage( chatId ) {
	console.debug( "sendMessage() ::", arguments );

	if (chatId == null) {
		return Promise.resolve( console.log( "sendMessage() :: Message not sended, no chatId" ));
	} else {
		return bot.sendMessage.apply( bot, arguments );
	}
}


/***************/

class GameAbstract {
	constructor( cnf = {} ) {
		console.debug( "new GameAbstract( cnf ) ::", cnf );

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
			this.$timeouts.push( setTimeout( cnf.timeoutFn, 1000 * cnf.timeout ));
			for (var tMinus in cnf.timeoutFn.tMinus) {
				if (typeof cnf.timeoutFn.tMinus[tMinus] == "function") {
					this.$timeouts.push( setTimeout( cnf.timeoutFn.tMinus[tMinus], 1000 * (cnf.timeout - parseInt( tMinus ))));
				}
			}
		}

		console.debug( "GameAbstract() ::", this );
	}

	toString( opts = {} ) {
		return this.board.map( row => {
			return row.map( char => {
				return "" + char.toUpperCase() + "";
			}).join( "\t" );
		}).join( "\n" );
	}
}

/*************************************/

/**
 * @param {number} [opts.size=5]           - Käytetyn laudan koko
 * @param {number} [opts.timeout=Infinity] - Kierroksen pituus
 * @param {string} [opts.chars=FIN]        - Käytetty kirjaimisto tai sen koodi
 */

function handleCmdPeli( msg, opts ) {
	console.debug( "handleCmdPeli( msg, opts ) ::", arguments );

	handleCmdPeli.parseOpts( opts );

	const chatId = msg.chat.id;

	if (games[ chatId ]) return sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.`, { disable_notification: true } );
	
	if (isFinite( opts.timeout ) && opts.timeout > 0) {
		opts.timeoutFn = () => {
			delete games[ chatId ];
			sendMessage( chatId, `Aika loppui! Peli päättyi.`, { disable_notification: true } );
		};
		opts.timeoutFn.tMinus = {
			5: () => {
				sendMessage( chatId, `Aikaa jäljellä viisi sekuntia!`, { disable_notification: true } );
			}
		};
		sendMessage( chatId, `Ajastetaan peli päättymään ${ opts.timeout } sekunnin kuluttua`, { disable_notification: true } );
	}

	const game = games[ chatId ] = new GameAbstract( opts );

	sendMessage( chatId, `Peli aloitettu ${ game.ctime.toLocaleString() }!\n`+"```\n" + game.toString() + "```", { parse_mode: "Markdown", disable_notification: true });

//	new Promise(( resolve, reject ) => {
//		try {
//			const canvas = require( "./StrArrToImage.js" )( game.board );
//			bot.sendPhoto( chatId, canvas.createPNGStream(), {}, { contentType: "image/png" }).then(resolve).catch(reject);
//		} catch( err ) { reject( err ); }
//	}).then( response => {
//		console.log("hereiam", response);
//	}).catch( err => {
//		console.error( err );
//		return sendMessage( chatId, "```\n" + game.toString() + "```", { parse_mode: "Markdown" });
//	}).then( response => {
//		console.log( "hereiam2", response );
//	});

}

handleCmdPeli.parseOpts = opts => {
	if (opts.size == null) opts.size = 5;
	else if (typeof opts.size != "number" || opts.size <= 0 || !isFinite(opts.size)) throw "Invalid argument opts.size";


	if (opts.timeout == null) opts.timeout = Infinity;
	else if (typeof opts.timeout != "number" || opts.timeout <= 0 || !isFinite(opts.timeout)) throw "Invalid argument opts.timeout";


	if (opts.chars == null) opts.chars  = "FIN"; 
	else if (typeof opts.chars != "string" || opts.chars.length == 0) throw "Invalid argument opts.chars";

	opts.chars = opts.chars.toLowerCase().replace( /[^\wåäö]/g, "");
};

/************************************************/

/**
 * @param {number} [opts.size=5]           - Käytetyn laudan koko
 * @param {number} [opts.timeout=Infinity] - Kierroksen pituus
 * @param {number} [opts.rounds=1]         - Kierrosten lukumäärä
 * @param {number} [opts.delay=Infinity]   - Kierrosten välinen aika
 * @param {string} [opts.chars=FIN]        - Käytetty kirjaimisto tai sen koodi
 */
function handleCmdKisa( msg, opts ) {
	console.debug( "handleCmdKisa( msg, opts ) ::", arguments );

	const chatId = msg.chat.id;
	
	if (games[ chatId ]) return sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.`, { disable_notification: true } );

	handleCmdKisa.parseOpts( opts );
	
	if (opts.timeout == null || !isFinite(opts.timeout)) throw "Not implemented yet! (opts.timeout unsetted)"; 


	iterateRound();

	function iterateRound() {
		if (isFinite( opts.timeout ) && opts.timeout > 0) {
			opts.timeoutFn = () => {
				var game   = games[ chatId ];
				var scores = getKisaScores( game );

				console.log( "Scores:", scores );
				delete games[ chatId ];

				sendMessage( chatId, `Aika loppui! Peli päättyi.`, { disable_notification: true } );

				var score_txt = "";
				for (var id in scores) {
					var score = scores[id];
					score_txt += `\n\n${ game.players[id].label }, `;
					
					if (Object.keys( scores ).length == 1) {
						score_txt += `${ score.words.length } sanaa.`;
					} else {
						if (score.words.length == score.uniques.length) {
							score_txt += `${ score.words.length } sanaa, kaikki uniikkeja.`;
						} else {
							score_txt += `${ score.words.length } sanaa, ${ score.uniques.length } uniikkia.`;
						}
					}

					for (var word in score.founds) {
						var paths = score.founds[word];
						for (var path of paths) {
							score_txt += `\n${word} - ${ path }`;
						}
					}
				}

				sendMessage( chatId, "Tulokset:" + score_txt, { disable_notification: true } );
			};
			opts.timeoutFn.tMinus = {
				5: () => {
					sendMessage( chatId, `Aikaa jäljellä viisi sekuntia!`, { disable_notification: true } );
				}
			};
			sendMessage( chatId, `Ajastetaan peli päättymään ${ opts.timeout } sekunnin kuluttua`, { disable_notification: true } );
		}

		const game = games[ chatId ] = new GameAbstract( opts );

		sendMessage( chatId, `Peli aloitettu ${ game.ctime.toLocaleString() }!\n`+"```\n" + game.toString() + "```", { parse_mode: "Markdown", disable_notification: true });
	};
}
handleCmdKisa.parseOpts = opts => {
	handleCmdPeli.parseOpts( opts );

	if (opts.rounds == null) opts.rounds = 1;
	if (typeof opts.rounds != "number" || opts.rounds < 1 || !isFinite(opts.rounds)) throw "Invalid argument opts.rounds";


	if (opts.delay == null) opts.delay = Infinity;
	else if (typeof opts.delay != "number" || opts.delay <= 0 || !isFinite(opts.delay)) throw "Invalid argument opts.delay";
}

function getKisaScores( game ) {
	var players = game.players;
	var scores = {};
	var words = {};
	var chars = [];
	game.board.forEach( row => row.forEach( char => {
		if (chars.indexOf( char ) == -1) chars.push( char );
	}));
	var chars_regexp = new RegExp( "^(["+chars.join("").toUpperCase()+"]+)$");

	console.debug( "getKisaScores() :: regexp", chars_regexp);

	for (var id in players) {
		var words = [];
		for (msg of players[id].$msgs) {
			try {
				var _words = msg.text.trim().toUpperCase().split( /[\s]+/g ).filter(word => word.length >= 2)
	
				for (word of _words) {
					if (words.indexOf(word) == -1) {
						words.push(word);
					}
				}
			} catch(e) {}
		}

		// Siivotaan pois merkkijonot joissa on merkistön ulkopuolisia merkkejä
		words = words.filter( word => chars_regexp.test( word ));

		// Parsitaan jäljelle vain sanat, jotka löytyvät matriisista
		scores[id] = { uniques: [], founds: {} };
		for (var word of words) {
			var paths = Object.keys( StringInMatrice( word, game.board ));
			if (paths.length > 0) {
				scores[id].founds[ word ] = paths;

				(words[ word ] = words[ word ] || []).push( id );
			}
		}
		scores[id].words = Object.keys( scores[id].founds );
	}

	for (var word in words) {
		if (words[word].length == 1) {
			scores[id].uniques.push( word );
		}
	}

	for (var id in scores) {
	}
	
	return scores;
};
