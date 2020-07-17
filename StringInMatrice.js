module.exports = function StringInMatrice( str, matrice ) {
//	console.log( "StringInMatrice( str, matrice ) ::", arguments );
    var height = matrice.length;
    var width  = matrice[0].length;

    var starts = [];
    for (var y = 0; y < height; y++) for (var x = 0; x < width; x++) if (match( matrice[y][x], str[0] )) starts.push([ y, x ]);

    var results = [];
    for (var start of starts) {
        var resp = iterateChars( start, str.substr(1), [ start ] );

		// Parsitaan pois väärän pituiset merkkijonot (kesken jääneet löydöt)
//        console.log( "START:", str[0], start, resp);
		resp = resp.filter( arr => arr.length == str.length );

        results = results.concat( resp );
    }

    var obj = {};
    results.forEach( arr => { obj[ JSON.stringify( arr )] = arr; });
    return obj;


    /**
        Palauttaa taulukollisen taulukoita seuraavien merkkien sijainneista, sisältää annetun sijainnin ensimmäisenä alkiona
    */
    function iterateChars( pos, chars, prevs = [] ) {
//        console.log( "iterateChars( pos, chars, prevs) ::", arguments );

        var results = [];
		var nextChar = chars[0];

		if (!nextChar) {
			// Ei enempää merkkejä, mennään nykyisellä
            return [ pos ];
        }

		// Läpikäydään ympäristö seuraavan merkin varalta
        var nextPoss = cNext( pos, nextChar, prevs );

		// Oli vain yksi merkki jäljellä, ei siis tarvitse enää iteroida
		if (chars.length == 1) {
            return nextPoss.map( nxt => ([ pos ].concat([ nxt ])));
        }

        /****/

        for (var i in nextPoss ) {
            var _nextPos = nextPoss[i];
            results = results.concat([[ _nextPos ]]);

			if (chars.length > 1 ) {
                var _nextChars = chars.substr(1);
                results = results.concat( iterateChars( _nextPos, _nextChars, prevs.concat([ _nextPos ]) ));
            }
        }

        return results.filter( v => v.length == chars.length ).map(v => [ pos ].concat( v ));
    }


    function match( a, b ){
        return a.toUpperCase() == b.toUpperCase();
    }

    function cNext( pos, nChar, prevs = [] ) {
		var ignores = prevs.map( pos => pos.join("-"));
        var nexts = [];

        for (var y = -1; y <= 1; y++ ) {
            for (var x = -1; x <= 1; x++ ) {
                if (x == 0 && y == 0) continue;

				var ny = pos[0] + y;
				var nx = pos[1] + x;

                if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;

				// Jos seuraava merkki vastaa skannattavan ruudun merkkiä, eikä löydy ignore-taulusta, lisätään löytyneiden listaan.
                if (match( nChar, matrice[ny][nx])
                 && ignores.indexOf( ny + "-" + nx ) == -1) {
					nexts.push([ ny, nx ]);
				}
            }
        }
        return nexts;
    }
}
