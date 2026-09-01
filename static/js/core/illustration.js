/*
This file is part of Ardoise - A Plume🪶 document generator

Copyright © Erwan Barbedor
Licensed under the MIT License — see LICENSE for details.
*/

document.querySelectorAll(".ardoise--frame--illustration-top-bottom").forEach(e => {
	// Récupère le .ardoise--frame parent
	const frame = e.closest(".ardoise--frame")
	if (!frame) return
	// .ardoise--frame--illustration-top-bottom est forcément une image de 400px (largeur) sur 100px (hauteur)
	// Place là et scale là de manière à ce que le point de coordonnée (400, 10) soit exactement sur le point (100%, 0) de la frame (en haut à droite) et que le point de coordonnés (400, 90) soit sur (100%, 100%) (en bas à droite)
	// Retire le display none CSS de l'élément
	// image rows 10..90 (80px) span the frame's full height, right edge on the frame's right edge
	const px = v => Math.round(v * 100) / 100 + "px"
	const place = () => {
		const s = frame.clientHeight / 80
		Object.assign(e.style, {
			display: "block",
			position: "absolute",
			top: px(-10 * s),
			right: "0",
			width: px(400 * s),
			height: px(100 * s)
		})
	}
	place()

	// relayout when the frame resizes or the web fonts settle
	if (typeof ResizeObserver !== "undefined") {
		new ResizeObserver(place).observe(frame)
	} else {
		window.addEventListener("resize", place)
	}
	if (document.fonts && document.fonts.ready)
		document.fonts.ready.then(place).catch(() => {})
})

document.querySelectorAll(".ardoise--frame--illustration--top").forEach(e => {
	// Récupère le .ardoise--frame parent
	const frame = e.closest(".ardoise--frame")
	if (!frame) return
	// Similaire, sauf qu'on fait (400, 90) (image) -> (100%, 0)  (en haut à droite).
	// Largeur configurable via dataset width
	// image point (400, 90) on the frame's top-right corner; width from data-width (px, default: frame width)
	const px = v => Math.round(v * 100) / 100 + "px"
	const place = () => {
		const w = parseFloat(e.dataset.width) || frame.clientWidth
		const s = w / 400
		Object.assign(e.style, {
			display: "block",
			position: "absolute",
			top: px(-90 * s),
			right: "0",
			width: px(w),
			height: px(100 * s)
		})
	}
	place()

	// relayout when the frame resizes or the web fonts settle
	if (typeof ResizeObserver !== "undefined") {
		new ResizeObserver(place).observe(frame)
	} else {
		window.addEventListener("resize", place)
	}
	if (document.fonts && document.fonts.ready)
		document.fonts.ready.then(place).catch(() => {})
})
