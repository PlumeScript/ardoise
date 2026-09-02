/*
This file is part of Ardoise - A Plume🪶 document generator

Copyright © Erwan Barbedor
Licensed under the MIT License — see LICENSE for details.
*/

(() => {
	// The illustration intentionally overflows its frame, while the frame (and
	// the .pages--content slot) clip their overflow — so the image cannot be a
	// descendant of the frame. It is moved up to the closest .pages--page,
	// which keeps it a relative of the page in the HTML, and re-anchored so it
	// stays at the exact same visual position.
	function hoist(e, frame) {
		const page = frame.closest(".pages--page")
		if (!page) return null
		// page-level containing block for the absolute image
		if (getComputedStyle(page).position === "static")
			page.style.position = "relative"
		page.appendChild(e)
		return page
	}

	// Padding-box rect of el in viewport coordinates (borders excluded)
	function padBox(el) {
		const r = el.getBoundingClientRect()
		const c = getComputedStyle(el)
		return {
			left: r.left + parseFloat(c.borderLeftWidth),
			top: r.top + parseFloat(c.borderTopWidth),
			right: r.right - parseFloat(c.borderRightWidth)
		}
	}

	const px = v => Math.round(v * 100) / 100 + "px"

	// Relayout: frame size changes (RO), content mutations that shift the
	// frame without resizing it (MathJax re-typeset), and late webfonts
	function relayout(frame, page, place) {
		let scheduled = false
		const schedule = () => {
			if (scheduled) return
			scheduled = true
			requestAnimationFrame(() => {
				scheduled = false
				place()
			})
		}
		if (typeof ResizeObserver !== "undefined") {
			new ResizeObserver(schedule).observe(frame)
		} else {
			window.addEventListener("resize", schedule)
		}
		if (page) {
			// the image lives outside the content slot, so its own style
			// writes can never retrigger the observer
			const content = page.querySelector(".pages--content")
			if (content)
				new MutationObserver(schedule).observe(content, { childList: true, subtree: true, characterData: true })
		}
		if (document.fonts && document.fonts.ready)
			document.fonts.ready.then(schedule).catch(() => {})
	}

	document.querySelectorAll(".ardoise--frame--illustration--top-bottom").forEach(e => {
		// Récupère le .ardoise--frame parent
		const frame = e.closest(".ardoise--frame")
		if (!frame) return
		// .ardoise--frame--illustration-top-bottom est forcément une image de 400px (largeur) sur 100px (hauteur)
		// Place là et scale là de manière à ce que le point de coordonnée (400, 10) soit exactement sur le point (100%, 0) de la frame (en haut à droite) et que le point de coordonnés (400, 90) soit sur (100%, 100%) (en bas à droite)
		// Retire le display none CSS de l'élément
		// image rows 10..90 (80px) span the frame's full height, right edge on the frame's right edge
		const page = hoist(e, frame)
		const place = () => {
			const s = frame.clientHeight / 80
			if (page) {
				// same rect as before, expressed against the page's padding box
				const f = padBox(frame)
				const p = padBox(page)
				Object.assign(e.style, {
					display: "block",
					position: "absolute",
					left: px(f.right - 400 * s - p.left),
					top: px(f.top - 10 * s - p.top),
					width: px(400 * s),
					height: px(100 * s)
				})
			} else {
				// no .pages--page (pagination disabled): stay inside the frame
				Object.assign(e.style, {
					display: "block",
					position: "absolute",
					top: px(-10 * s),
					right: "0",
					width: px(400 * s),
					height: px(100 * s)
				})
			}
		}
		place()
		relayout(frame, page, place)
	})

	document.querySelectorAll(".ardoise--frame--illustration--top").forEach(e => {
		// Récupère le .ardoise--frame parent
		const frame = e.closest(".ardoise--frame")
		if (!frame) return
		// Similaire, sauf qu'on fait (400, 90) (image) -> (100%, 0)  (en haut à droite).
		// Largeur configurable via dataset width
		// image point (400, 90) on the frame's top-right corner; width from data-width (px, default: frame width)
		const page = hoist(e, frame)
		const place = () => {
			const w = parseFloat(e.dataset.width) || frame.clientWidth
			const s = w / 400
			if (page) {
				const f = padBox(frame)
				const p = padBox(page)
				Object.assign(e.style, {
					display: "block",
					position: "absolute",
					left: px(f.right - w - p.left),
					top: px(f.top - 90 * s - p.top),
					width: px(w),
					height: px(100 * s)
				})
			} else {
				Object.assign(e.style, {
					display: "block",
					position: "absolute",
					top: px(-90 * s),
					right: "0",
					width: px(w),
					height: px(100 * s)
				})
			}
		}
		place()
		relayout(frame, page, place)
	})
})();
