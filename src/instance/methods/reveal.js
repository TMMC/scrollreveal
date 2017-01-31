import style from '../functions/style'
import initialize from '../functions/initialize'

import { getNode, getNodes, logger } from '../../utils/core'
import { deepAssign, each, nextUniqueId } from '../../utils/generic'
import { isMobile } from '../../utils/browser'


export default function reveal (target, options, interval, sync) {

	/**
	 * The reveal method has an optional 2nd parameter,
	 * so here we just shuffle things around to accept
	 * the interval being passed as the 2nd argument.
	 */
	if (typeof options === 'number') {
		interval = parseInt(options)
		options = {}
	} else {
		options = options || {}
	}

	const config = deepAssign({}, this.defaults, options)
	const containers = this.store.containers
	const container = getNode(config.container)
	const targets = getNodes(target, container)

	if (!targets.length) {
		logger('Reveal aborted.', 'Reveal cannot be performed on 0 elements.')
		return this
	}

	/**
	 * Verify our platform matches our platform configuration.
	 */
	if (!config.mobile && isMobile() || !config.desktop && !isMobile()) {
		logger('Reveal aborted.', 'This platform has been disabled.')
		return this
	}

	/**
	 * Sequence intervals must be at least 16ms (60fps)
	 * but can be negative for sequencing in reverse.
	 */
	let sequence
	if (typeof interval == 'number' && Math.abs(interval) >= 16) {
		const sequenceId = nextUniqueId()
		sequence = {
			elementIds: [],
			head: { index: null, blocked: false },
			tail: { index: null, blocked: false },
			id: sequenceId,
			interval: Math.abs(interval),
		}
	}

	let containerId
	each(containers, storedContainer => {
		if (!containerId && storedContainer.node === container) {
			containerId = storedContainer.id
		}
	})

	if (isNaN(containerId)) {
		containerId = nextUniqueId()
	}

	try {
		const elements = targets.map(node => {
			const element = {}
			const existingId = node.getAttribute('data-sr-id')

			if (existingId) {
				deepAssign(element, this.store.elements[existingId])

				/**
				 * In order to prevent previously generated styles
				 * from throwing off the new styles, the style tag
				 * has to be reverted to it's pre-reveal state.
				 */
				element.node.setAttribute('style', element.styles.inline)

			} else {
				element.id = nextUniqueId()
				element.node = node
				element.seen = false
				element.visible = false
			}

			element.config = config
			element.containerId = containerId
			element.styles = style(element)

			if (sequence) {
				element.sequence = {
					id: sequence.id,
					index: sequence.elementIds.length,
				}
				sequence.elementIds.push(element.id)
			}

			return element
		})

		/**
		* Modifying the DOM via setAttribute needs to be handled
		* separately from reading computed styles in the map above
		* for the browser to batch DOM changes (limiting reflows)
		*/
		each(elements, element => {
			this.store.elements[element.id] = element
			element.node.setAttribute('data-sr-id', element.id)
		})

	} catch (error) {
		logger('Reveal failed.', error.message)
		return this
	}

	containers[containerId] = containers[containerId] || {
		id: containerId,
		node: container,
	}

	if (sequence) {
		this.store.sequences[sequence.id] = sequence
	}

	/**
	* If reveal wasn't invoked by sync, we want to
	* make sure to add this call to the history.
	*/
	if (!sync) {
		this.store.history.push({ target, options, interval })

		/**
		* Push initialization to the event queue, giving
		* multiple reveal calls time to be interpretted.
		*/
		if (this.initTimeout) {
			window.clearTimeout(this.initTimeout)
		}
		this.initTimeout = window.setTimeout(initialize.bind(this), 0)
	}

	return this
}
