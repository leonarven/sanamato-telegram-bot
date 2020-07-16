const { createCanvas, loadImage } = require('canvas')

module.exports = StrArrToCanvas;

function StrArrToCanvas( matrice = [[]], opts = {} ) {
	const height = matrice.length;
	const width  = matrice[0].length;

	const xOffset = 5;
	const yOffset = 5;

//	const canvas1 = createCanvas( 1, 1 );
//	const ctx1 = canvas1.getContext( '2d' );
//	ctx1.font = '30px Monospace';


	const charSize = 30; //ctx1.measureText( '0' ).height;


	const canvas = createCanvas( xOffset+width*charSize, yOffset+height*charSize );
	const ctx = canvas.getContext( '2d' );
	ctx.font = '30px Monospace';

	for (var y = 0; y < height; y++) {
		for( var x = 0; x < width; x++) {
			ctx.fillText( matrice[y][x].toString(), xOffset+x*charSize, (y+1)*charSize )
		}
	}

	ctx.stroke()

	return canvas;
}

function StrArrToImageStream( matrice = [[]], opts = {} ) {
	const canvas = StrArrToCanvas( matrice, opts );
	const dataURL = canvas.toDataURL();
	return dataURL;
	const stream = cainvas.createJPEGStream();
	return stream;
}
