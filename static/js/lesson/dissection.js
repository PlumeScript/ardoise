/*
This file is part of Ardoise - A Plume🪶 document generator

Copyright © Erwan Barbedor
Licensed under the MIT License — see LICENSE for details.
*/

(() => {
	const NS = 'http://www.w3.org/2000/svg'
	const tagRE = /^dissection-(\d+)-(\d+)-(to|from)$/
	const px = v => (Math.round(v * 100) / 100) + 'px'

	function setStyle(el, name, value) {
		if (el.style[name] !== value) el.style[name] = value
	}

	function tagOf(el) {
		for (const c of el.classList) {
			const m = tagRE.exec(c)
			if (m) return `${m[1]}-${m[2]}:${m[3]}`
		}
		return null
	}

	// Read a CSS length variable (em or px) in local units, with a px fallback
	function cssLen(el, name, fallback) {
		const m = /^([\d.]+)(em|px)$/.exec(getComputedStyle(el).getPropertyValue(name).trim())
		if (!m) return fallback
		const v = parseFloat(m[1])
		return m[2] === 'em' ? v * parseFloat(getComputedStyle(el).fontSize) : v
	}

	// Visual px rendered per local px. Probed on an existing line (attribute
	// changes only, no DOM churn); falls back to the block's own ratio.
	function scaleOf(svg, block) {
		const line = svg.querySelector('line')
		if (line) {
			const x1 = line.getAttribute('x1')
			const x2 = line.getAttribute('x2')
			line.setAttribute('x1', 0)
			line.setAttribute('x2', 100)
			const w = line.getBoundingClientRect().width
			line.setAttribute('x1', x1)
			line.setAttribute('x2', x2)
			if (w > 0) return w / 100
		}
		const w = block.offsetWidth
		return w ? (block.getBoundingClientRect().width / w) || 1 : 1
	}

	// Pair -from labels with -to words by their shared N-M key.
	// Words are any tagged element (plain span or MathJax output).
	function scan(block) {
		const words = new Map()
		const labels = []
		for (const el of block.querySelectorAll('*')) {
			const tag = tagOf(el)
			if (!tag) continue
			const key = tag.slice(0, tag.lastIndexOf(':'))
			if (tag.endsWith(':to')) words.set(key, el)
			else labels.push({ key, el })
		}
		return labels
			.filter(l => words.has(l.key))
			.map(l => ({ ...l, word: words.get(l.key) }))
	}

	function sameItems(a, b) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++)
			if (a[i].el !== b[i].el || a[i].word !== b[i].word) return false
		return true
	}

	// Isotonic regression (non-decreasing least-squares fit, pool adjacent
	// violators): within a tight group the block value is the mean, so the
	// slack forced by the gap is shared equally by its labels.
	function isotonic(values) {
		const out = new Array(values.length)
		const blocks = [] // [sum, count, start]
		let i = 0
		for (const value of values) {
			blocks.push([value, 1, i++])
			while (blocks.length > 1) {
				const top = blocks[blocks.length - 1]
				const prev = blocks[blocks.length - 2]
				if (prev[0] / prev[1] <= top[0] / top[1]) break
				prev[0] += top[0]
				prev[1] += top[1]
				blocks.pop()
			}
		}
		for (const [sum, count, start] of blocks)
			for (let i = start; i < start + count; i++) out[i] = sum / count
		return out
	}

	function prepare(block) {
		// Containing block for the SVG overlay, guaranteed inline
		setStyle(block, 'position', 'relative')
		const state = { block, legend: null, svg: null, items: [], run: null, lastLines: '' }

		// (Re)pair the content and rebuild the layout closure
		state.refresh = () => {
			state.items = scan(block)
			state.legend = block.querySelector('.ardoise--dissection--legend')
			if (!state.items.length || !state.legend) {
				if (state.svg) {
					state.svg.remove()
					state.svg = null
				}
				state.run = null
				return
			}
			// Containing block for the labels, guaranteed inline
			setStyle(state.legend, 'position', 'relative')
			// Overlay created once, geometry guaranteed inline so it does
			// not depend on the stylesheet being loaded
			if (!state.svg) {
				const svg = document.createElementNS(NS, 'svg')
				svg.setAttribute('class', 'ardoise--dissection--links')
				Object.assign(svg.style, {
					position: 'absolute',
					top: '0', left: '0',
					width: '100%', height: '100%',
					pointerEvents: 'none',
					overflow: 'visible'
				})
				block.appendChild(svg)
				state.svg = svg
			}
			const { legend, svg, items } = state

			state.run = () => {
				if (!block.offsetWidth) return
				const s = scaleOf(svg, block)
				const box = block.getBoundingClientRect()
				// Number of label rows, fixed by the block's data-rows (1 = one line)
				const rows = Math.max(1, parseInt(block.dataset.rows, 10) || 1)
				// Extra distance between two label rows (0 = rows touching)
				const rowGap = cssLen(block, '--ardoise--dissection-label-row-gap', parseFloat(getComputedStyle(block).fontSize))
				// One label row of text: font size, without line-height leading
				const rowH = parseFloat(getComputedStyle(legend).fontSize) / s

				// One line of the legend's text, in local units, captured on
				// first run with a probe glyph: the legend's own height can
				// span several wrapped lines of inline labels
				if (legend._ardNaturalH == null) {
					const probe = document.createElement('span')
					probe.textContent = 'x'
					legend.appendChild(probe)
					legend._ardNaturalH = probe.getBoundingClientRect().height / s
					probe.remove()
				}
				setStyle(legend, 'height', px(legend._ardNaturalH + (rows - 1) * (rowH + rowGap)))
				// Band between the --show line and the labels, room for the link lines
				setStyle(legend, 'marginTop', px(cssLen(block, '--ardoise--dissection-label-offset', 32)))

				const legendBox = legend.getBoundingClientRect()
				const legendL = (legendBox.left - box.left) / s
				const gap = cssLen(block, '--ardoise--dissection-label-gap', 6)
				// Gap between each link end and the text box edge it faces
				const showGap = cssLen(block, '--ardoise--dissection-show-gap', 3)
				const legendGap = cssLen(block, '--ardoise--dissection-legend-gap', 3)

				// Target: horizontal center of the word, in local coordinates.
				// Each link end stops a gap away from the text box edge it
				// faces, so both ends keep a margin without font metrics.
				for (const it of items) {
					const wr = it.word.getBoundingClientRect()
					const lr = it.el.getBoundingClientRect()
					it.w = lr.width / s
					it.left = (wr.left - legendBox.left + wr.width / 2) / s - it.w / 2
					it.wordCenter = (wr.left + wr.width / 2 - box.left) / s
					it.lineStart = (wr.bottom - box.top + showGap) / s
				}

				// Keep word order, then deal the labels round-robin over the
				// rows (1,3,5.. on row 0, 2,4.. on row 1, ...), each row
				// keeping the word order. Within a row, isotonic regression
				// over the non-overlap constraints minimizes the total
				// displacement, so the link angles are evened out instead of
				// piling up on the last label. The row may extend past the
				// block when the block is narrower than the label row.
				// With two rows, line-2 labels skip the constraints: they
				// are aimed below, onto the straight link that threads the
				// nearest line-1 gap (the label gap keeps the link clear).
				const ordered = [...items].sort((a, b) => a.left - b.left)
				for (let r = 0; r < rows; r++) {
					const row = []
					for (let i = r; i < ordered.length; i += rows) row.push(ordered[i])
					if (rows === 2 && r === 1) continue
					const d = new Array(row.length)
					for (let i = 0; i < row.length; i++)
						d[i] = i === 0 ? 0 : d[i - 1] + row[i - 1].w + gap
					const v = isotonic(row.map((it, i) => it.left - d[i]))
					for (let i = 0; i < row.length; i++)
						row[i].left = d[i] + Math.max(0, v[i])
				}

				// Rows stack down from the legend's top; each link ends a gap
				// above the row it faces
				const legendTop = (legendBox.top - box.top) / s
				for (let i = 0; i < ordered.length; i++) {
					const it = ordered[i]
					it.row = i % rows
					it.top = it.row * (rowH + rowGap)
					it.lineEnd = legendTop + it.top - legendGap
				}
				// With two rows, aim each line-2 label: its link is a
				// straight line from the word through the nearest line-1
				// gap (label gap + margins), and the label lands on the
				// line's lower end
				if (rows === 2) {
					const top = ordered.filter(it => it.row === 0)
					const chans = [legendL + top[0].left - gap]
					for (let i = 0; i + 1 < top.length; i++)
						chans.push((legendL + top[i].left + top[i].w + legendL + top[i + 1].left) / 2)
					chans.push(legendL + top[top.length - 1].left + top[top.length - 1].w + gap)
					const yMid = legendTop + legend._ardNaturalH / 2
					const yT = legendTop + (rowH + rowGap) - legendGap
					for (const it of ordered) {
						if (it.row !== 1) continue
						const x0 = it.wordCenter, y0 = it.lineStart
						let xc = chans[0]
						for (const c of chans) if (Math.abs(c - x0) < Math.abs(xc - x0)) xc = c
						it.left = xc + (xc - x0) * (yT - yMid) / (yMid - y0) - legendL - it.w / 2
					}
				}
				for (const it of ordered) {
					setStyle(it.el, 'position', 'absolute')
					setStyle(it.el, 'top', px(it.top))
					setStyle(it.el, 'left', px(it.left))
				}

				// One straight line per pair, rebuilt only when it changes
				const sig = ordered.map(it =>
					`${it.wordCenter}|${it.lineStart}|${legendL + it.left + it.w / 2}|${it.lineEnd}`).join(';')
				if (sig !== state.lastLines) {
					state.lastLines = sig
					svg.replaceChildren()
					for (const it of ordered) {
						const line = document.createElementNS(NS, 'line')
						line.setAttribute('x1', it.wordCenter)
						line.setAttribute('y1', it.lineStart)
						line.setAttribute('y2', it.lineEnd)
						line.setAttribute('x2', legendL + it.left + it.w / 2)
						svg.appendChild(line)
					}
				}
			}
		}
		state.refresh()
		return state
	}

	const states = new Map()
	const blocks = () => document.querySelectorAll('.ardoise--dissection')
	const runAll = () => {
		for (const st of states.values()) if (st.run) st.run()
	}

	// Relayout on resize and once web fonts settle
	let sizing = false
	const schedule = () => {
		if (sizing) return
		sizing = true
		requestAnimationFrame(() => {
			sizing = false
			runAll()
		})
	}
	let ro = null
	if (typeof ResizeObserver !== 'undefined') {
		ro = new ResizeObserver(schedule)
		for (const block of blocks()) ro.observe(block)
	} else {
		window.addEventListener('resize', schedule)
	}

	// Re-scan the pairing and relayout only when it actually changed.
	// The layout itself mutates the DOM, so changes must be detected by
	// identity, not assumed.
	let refreshing = false
	const scheduleRefresh = () => {
		if (refreshing) return
		refreshing = true
		requestAnimationFrame(() => {
			refreshing = false
			let dirty = false
			for (const block of blocks()) {
				let st = states.get(block)
				if (!st) {
					st = prepare(block)
					states.set(block, st)
					dirty = st.run != null
					continue
				}
				const fresh = scan(block)
				const needsRun = fresh.length > 0
				if (needsRun !== (st.run != null) || (needsRun && !sameItems(fresh, st.items))) {
					st.refresh()
					dirty = true
				}
			}
			if (ro) for (const block of blocks()) ro.observe(block)
			if (dirty) runAll()
		})
	}

	for (const block of blocks()) {
		const st = prepare(block)
		states.set(block, st)
	}
	runAll()

	// Words may appear or be replaced after the first layout: MathJax
	// typesets asynchronously and re-typesets on resize
	const mo = new MutationObserver(scheduleRefresh)
	mo.observe(document.body || document.documentElement, { childList: true, subtree: true })
	if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise)
		window.MathJax.startup.promise.then(scheduleRefresh).catch(() => {})
	if (document.fonts && document.fonts.ready)
		document.fonts.ready.then(schedule).catch(() => {})
})();
