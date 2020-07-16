/*
@see http://jkorpela.fi/kielikello/kirjtil.html

TAULUKKO 1. Grafeemien frekvenssi koko materiaalissa (n1),
litteroidussa puhekielessä (n2) ja kirjakielessä (n3).

         n1                n2                n3
         f        %        f        %        f        %
1.  a  457 350  11,62  a  160 812  11,14  a  296 538  11,90
2.  i  421 366  10,71  i  156 359  10,83  i  265 007  10,64
3.  t  388 711   9,88  t  145 442  10,07  t  243 269   9,77
4.  n  341 181   8,67  n  125 270   8,68  n  215 911   8,67
5.  e  323 087   8,21  e  118 642   8,22  e  204 445   8,21
6.  s  309 350   7,86  s  113 675   7,87  s  195 675   7,85
7.  l  226 627   5,76  l   85 074   5,89  l  141 553   5,68
8.  o  208 923   5,31  o   78 378   5,43  k  132 990   5,34
9.  k  207 520   5,27  ä   74 880   5,19  o  130 545   5,24
10. u  196 678   5,00  k   74 530   5,16  u  126 164   5,06
11. ä  189 134   4,81  u   70 514   4,88  ä  114 254   4,59
12. m  137 972   3,51  m   55 700   3,86  m   82 272   3,30
13. v   96 316   2,45  v   33 536   2,32  v   62 780   2,52
14. r   85 116   2,16  j   28 370   1,96  r   57 822   2,32
15. j   75 961   1,93  r   27 294   1,89  j   47 591   1,91
16. h   71 733   1,82  y   26 648   1,85  h   45 503   1,83
17. y   71 316   1,81  h   26 230   1,82  y   44 668   1,79
18. p   65 358   1,66  p   22 076   1,53  p   43 282   1,74
19. d   33 148   0,84  d   12 078   0,84  d   21 070   0,85
20. ö   18 655   0,47  ö    6 467   0,45  ö   12 188   0,49
21. g    4 151   0,11  g    1 005   0,07  g    3 146   0,13
22. b    2 068   0,05  b      475   0,03  b    1 593   0,06
23. f    1 934   0,05  f      395   0,03  f    1 539   0,06
24. c    1 091   0,03  c       52   0,00  c    1 041   0,04
25. w      329   0,01  w       22   0,00  w      307   0,01
26. å       52   0,00  å       20   0,00  å       30   0,00
27. q       26   0,00  q        1   0,00  q       25   0,00
                                                           
     3 935 153   100    1 443 945   100    2 491 208   100
     =========          =========          =========

@see https://docs.google.com/spreadsheets/d/1yNwGnnSyYNRLHZqy1gUQ9ug-W80pI9K40fu485PzNtM/edit?usp=sharing
*/
const CHAR_COUNTS = {
	'a':	17590,
	'i':	16206,
	't':	14950,
	'n':	13122,
	'e':	12426,
	's':	11898,
	'l':	8716,
	'o':	8035,
	'k':	7981,
	'u':	7564,
	'ä':	7274,
	'm':	5306,
	'v':	3704,
	'r':	3273,
	'j':	2921,
	'h':	2758,
	'y':	2742,
	'p':	2513,
	'd':	1274,
	'ö':	717,
	'g':	159,
	'b':	79,
	'f':	74,
	'c':	41,
	'w':	12,
	'å':	2,
	'q':	1
};

var CHAR_STR = "";
for (var char in CHAR_COUNTS) CHAR_STR += char.repeat( CHAR_COUNTS[char] );

const TelegramBot = require('node-telegram-bot-api');

const argv  = require('minimist')(process.argv.slice(2));
const token = argv.token;

if (!token) throw "Missing parameter --token";

const bot = new TelegramBot( token, { polling: true });

bot.on('polling_error', err => {
	console.error( "ERROR at bot.on(polling_error) ::", err );
});

function sendMessage() {
	console.debug( "sendMessage() ::", arguments );
	return bot.sendMessage.apply( bot, arguments );
}

/***************/

const chats = {};

class Chat {
	constructor( chatId, msgChat = {}) {
		this.id = chatId;
		this.title = msgChat.title || chatId;
	}

}

/***************/

const games = {};

class GameAbstract {
	constructor( cnf = {} ) {
		console.debug( "new GameAbstract( cnf ) ::", cnf );

		this.w = cnf.w || cnf.size || 5;
		this.h = cnf.h || cnf.size || 5;

		/** @TODO: selvitä oikean pelin merkit */
		if (cnf.chars == "fin" || !cnf.chars) cnf.chars = CHAR_STR;

		this.charsArr = cnf.chars.split("").map( v => [ v ]);

		this.ctime = new Date();

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
 * Komennon /peli käsittely
 * /peli /^\d+/ = A-pituinen kierros
 * /peli /^\d+/ /^\d+/ = A-pituinen kierros B-kokoisella laudalla
 * /peli /^\d+/ /^\d+/ xyz = A-pituinen kierros B-kokoisella laudalla käyttäen merkistöä xyz
 *
 * @param {number} [match[1]=5]    - Käytetyn laudan koko
 * @param {number} [match[2]=null] - Kierroksen pituus
 * @param {string} [match[3]=fin]  - Käytetty kirjaimisto tai sen koodi
 *
 *          -> CMD       |timeout   |size      |chars */
bot.onText(/^\/peli(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?\s*$/, (msg, match) => {
	console.debug( "bot.onText(\/start, ( msg, match )) :: ", msg, match );

	try {
		handleCmdPeli( msg, {
			size:    match[1] == null ? 5     : parseInt(match[1]),
			timeout: match[2] == null ? null  : parseInt(match[2]),
			chars:   match[3] == null ? "fin" : match[3]
		});
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/start) ::", err );
	}
});


/**
 * @param {number} [opts.size=5]           - Käytetyn laudan koko
 * @param {number} [opts.timeout=Infinity] - Kierroksen pituus
 * @param {string} [opts.chars=fin]        - Käytetty kirjaimisto tai sen koodi
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


	if (opts.chars == null) opts.chars  = "fin"; 
	else if (typeof opts.chars != "string" || opts.chars.length == 0) throw "Invalid argument opts.chars";

	opts.chars = opts.chars.toLowerCase().replace( /[^\wåäö]/g, "");
};

/************************************************/

/**
 * Komennon /kisa käsittely
 * /kisa /^\d+/ = A-kokoisella laudalla järjestetty manuaalisesti lopetettava peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ = A-kokoisella laudalla järjestetty, B-pituinen peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä, B-pituisia pelejä C-kpl, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ xyz = A-kokoisella laudalla järjestettyjä merkistöä zyx käyttäviä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 *
 * @param (number=5)         match[1] Käytetyn laudan koko
 * @param (number|undefined) match[2] Kierroksen pituus, jos halutaan
 * @param (number=1)         match[3] Kierrosten lukumäärä
 * @param (number|undefined) match[4] Automaatiolla (jos asetettu) määritelty kierrosten välinen aika
 * @param (string="fin")     match[5] Käytetty kirjaimisto tai sen koodi
 *
 *          -> CMD       |size      |timeout   |rounds    |delay     |chars */
bot.onText(/^\/kisa(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?)?)?\s*$/, (msg, match) => {
	console.debug( "bot.onText(\/kisa, ( msg, match )) :: ", msg, match );
	try {
		handleCmdKisa( msg, {
			size:    match[1] == null ? 5     : parseInt(match[1]),
			timeout: match[2] == null ? null  : parseInt(match[2]),
			rounds:  match[3] == null ? 1     : parseInt(match[3]),
			delay:   match[4] == null ? null  : parseInt(match[4]),
			chars:   match[5] == null ? "fin" : match[5]
		});
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/start) ::", err );
	}
});

/**
 * @param {number} [opts.size=5]           - Käytetyn laudan koko
 * @param {number} [opts.timeout=Infinity] - Kierroksen pituus
 * @param {number} [opts.rounds=1]         - Kierrosten lukumäärä
 * @param {number} [opts.delay=Infinity]   - Kierrosten välinen aika
 * @param {string} [opts.chars=fin]        - Käytetty kirjaimisto tai sen koodi
 */
function handleCmdKisa( msg, opts ) {
	console.debug( "handleCmdKisa( msg, opts ) ::", arguments );

	handleCmdKisa.parseOpts( opts );

	const chatId = msg.chat.id;
	
	if (games[ chatId ]) return sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.`, { disable_notification: true } );

	return console.debug( opts );
}
handleCmdKisa.parseOpts = opts => {
	handleCmdPeli.parseOpts( opts );

	if (opts.rounds == null) opts.rounds = 1;
	if (typeof opts.rounds != "number" || opts.rounds < 1 || !isFinite(opts.rounds)) throw "Invalid argument opts.rounds";


	if (opts.delay == null) opts.delay = Infinity;
	else if (typeof opts.delay != "number" || opts.delay <= 0 || !isFinite(opts.delay)) throw "Invalid argument opts.delay";
};

/************************************************/

/**
 */
bot.onText(/\/stop/, (msg, match) => {
	console.debug( "bot.onText(\/stop, ( msg, match )) :: ", msg, match );
	try {
		handleCmdStop( msg, match );
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/stop) ::", err );
	}
});

function handleCmdStop( msg, match ) {
	console.debug( "handleCmdStop( msg, opts ) ::", arguments );

	const chatId = msg.chat.id;
	const game = games[ chatId ];

	if (!game) return sendMessage( chatId, "Ei peliä, joka lopettaa!", { disable_notification: true } );

	for (var timeout of game.$timeouts) clearTimeout( timeout );

	delete games[ chatId ];

	sendMessage( chatId, "Peli lopetettu!", { disable_notification: true } );
}
