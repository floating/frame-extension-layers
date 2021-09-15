import React from 'react'
import Restore from 'react-restore'
import ReactDOM from 'react-dom'
import styled from 'styled-components'
import n from 'nebula'

import ethProvider from 'eth-provider'
import provider from './provider'
import inventory from './inventory'
import store from './store'
import themes from './themes'
import nft from './nft'
import './layer'

const fallbackProvider = provider(ethProvider())
const nebula = n('https://ipfs.nebula.land', fallbackProvider)

// TODO
const { getNft } = nft(fallbackProvider)

const firstChild = (element, count, i = 0) => {
  element = element.children[0]
  if (++i === count) return element
  return firstChild(element, count, i)
}

function equalsIgnoreCase (s1, s2) {
  return s1.toLowerCase() === s2.toLowerCase()
}

function parseEnsName (nameSpan) {
  return ((((nameSpan || {}).textContent || '').match(/[\w_\-\.]+.eth/) || [])[0] || '').toLowerCase()
}

function findNameSectionInHeader (profileHeader) {
  let handle, ensName, nameSection

  const headerPhoto = profileHeader.getElementsByTagName('a')[0]
  const headerHref = (headerPhoto || {}).href
  const match = headerHref.match(/^.*twitter\.com\/(?<handle>\w+)/)

  if (match) {
    handle = match.groups.handle.toLowerCase()

    const infoSection = profileHeader.children[1]

    nameSection = [...infoSection.children].find(block => {
      const spans = [...block.getElementsByTagName('span')]

      return spans.some(span => {
        const text = span.textContent || ''
        return text.startsWith('@') && equalsIgnoreCase(text.substring(1), handle)
      })
    })

    const ensNameSpan = nameSection.querySelector('span > span')
    ensName = parseEnsName(ensNameSpan)
  }

  return { nameSection, ensName, handle }
}

function findNameSectionInTweet (tweet) {
  const tweetLinks = [...tweet.querySelectorAll('a[role=link]')];

  return tweetLinks.reduce((data, link) => {
    if (data) return data

    const href = (link || {}).href
    const handle = href.split('/').reverse()[0].toLowerCase()

    const nameSpans = [...link.querySelectorAll('span')]

    // the name section will be one with a span that displays the same handle as the one in the link href
    const handleIndex = nameSpans.findIndex(span => {
      const text = span.textContent || ''
      return text.startsWith('@') && equalsIgnoreCase(text.substring(1), handle)
    })

    if (handleIndex > 0) {
      const ensNameSpan = nameSpans.slice(0, handleIndex).reverse().find(block => (block.textContent || '').includes('.eth'))
      const ensName = parseEnsName(ensNameSpan)

      return { nameSection: link, ensName, handle }
    }
  }, false)
}

function mouseBlocker (mount) {
  const blocker  = document.createElement('div')
  blocker.className = '__frameMountBlock__'
  blocker.style.cssText = `
    width: 4px;
    height: 20px;
    position: absolute;
    top: 0;
    left: 75px;
    pointer-events: auto;
  `
  mount.appendChild(blocker)
}

function updateHeaderBadge (root) {
  const nav = root.querySelector('[data-testid=primaryColumn] nav')
  if (nav) {
    const profileHeader = nav.previousElementSibling

    if (profileHeader) {
      const { ensName, handle, nameSection } = findNameSectionInHeader(profileHeader)

      const existingBadge = profileHeader.querySelector('.__frameMount__')

      if (existingBadge) {
        if (existingBadge.getAttribute('handle') === handle) {
          // badge already rendered correctly
          return
        }

        // outdated badge
        existingBadge.remove()
      }

      if (ensName) {
        insertBadge(nameSection, ensName, handle)
      }
    }
  }
}

async function insertBadge (element, ensName, handle) {
  const userId = ensName.replace(/\./g,'-')
  const mount = document.createElement('div')
  mount.setAttribute('handle', handle)
  mount.className = '__frameMount__'
  mount.style.cssText = `
    width: 16px;
    height: 20px;
    pointer-events: auto;
    display: inline-block;
    position: relative;
    vertical-align: -20%;
    margin-right: 4px;
    margin-left: -2px;
  `
  insertAfter(mount, element)

  const ConnectedBadge = Restore.connect(Badge, store)
  ReactDOM.render(<ConnectedBadge userId={userId} />, mount)

  mouseBlocker(element)

  // If user has been scanned already
  if (usersChecked.includes(userId)) return
  usersChecked.push(userId)

  try {
    const { record, address } = await nebula.resolve(ensName)
    if (!record) return

    const user = {
      name: record.name || '',
      avatar: record.text && record.text.avatar ? record.text.avatar : '',
      address: address ? address.toLowerCase() : '',
      twitter: record.text && record.text['com.twitter'] ? record.text['com.twitter'] : ''
    }

    user.verified = {
      name: address && equalsIgnoreCase(handle, user.twitter),
      avatar: false
    }
    const compatible = 'eip155:1/erc721:'
    const index = user.avatar.indexOf(compatible)
    const nftAvatar = index > -1
    if (nftAvatar) {
      const location = user.avatar.subsrt(index + compatible.length)
      const [contract, tokenId] = location.split('/')
      console.log('We have an NFT avatar', contract, tokenId)
    }

    if (record.addresses.eth) {
      user.inventory = await inventory(record.addresses.eth)
    }

    // Map and type media
    Object.keys(user.inventory).forEach(collection => {
      const { meta, assets } = user.inventory[collection]
      meta.priority = meta.img ? 1 : 0
      const img = meta.img ? meta.img : assets[Object.keys(assets).filter(k => assets[k].img).sort((a, b) => {
        if (assets[a].tokenId < assets[b].tokenId) return -1
        if (assets[a].tokenId > assets[b].tokenId) return 1
        return 0
      })[0]]?.img
      meta.img = { src: img || '' }
      meta.img.type = meta.img.src.endsWith('.mp4') || meta.img.src.endsWith('.mov') ? 'video' : 'img'

      Object.keys(assets).forEach(asset => {
        const { img, animation, thumbnail } = assets[asset]
        assets[asset].img = { src: animation || img || '' }
        assets[asset].img.type = assets[asset].img.src.endsWith('.mp4') || assets[asset].img.src.endsWith('.mov') ? 'video' : 'img'
        assets[asset].thumbnail = { src: thumbnail || animation || img || ''}
        assets[asset].thumbnail.type = assets[asset].thumbnail.src.endsWith('.mp4') || assets[asset].thumbnail.src.endsWith('.mov') ? 'video' : 'img'
      })
    })

    store.setUser(userId, user)
  } catch (e) {
    console.error('could not show verification badge', e)
    store.setUser(userId, { error: e.message })
  }
}

const root = document.getElementById('react-root')

const config = { childList: true, subtree: true }

const Container = styled.div`
  cursor: pointer;
  justify-content: center;
  align-items: center;
  pointer-events: none;
`

class Badge extends React.Component {
  constructor () {
    super()
    this.state = {
      showEthPanel: false
    }
  }
  badge (size) {
    const theme = store('theme')
    const { userId  } = this.props
    const user = userId ? this.store('users', userId) : ''
    let color, background
    if (user && !user.error && user.verified.name) {
      color = theme.badge.verified.color
      background = theme.badge.verified.background
    } else if (user && user.error) {
      color = theme.badge.unverified.color
      background = theme.badge.unverified.background
    } else {
      color = theme.badge.default.color
      background = theme.badge.default.background
    }

    return (
      <svg style={{ height: `${size}px`, width: `${size}px` }}  viewBox='0 0 84 84'>
        <path fill={background} d='M84,44a16.1,16.1,0,0,0-8.59-14.4,16.63,16.63,0,0,0,1-5.6c0-8.84-6.84-16-15.27-16a14.2,14.2,0,0,0-5.34,1A15,15,0,0,0,28.26,9a14.45,14.45,0,0,0-5.35-1C14.47,8,7.64,15.16,7.64,24a16.63,16.63,0,0,0,1,5.6,16.38,16.38,0,0,0-.82,28.34A17.53,17.53,0,0,0,7.64,60c0,8.84,6.83,16,15.27,16a14.4,14.4,0,0,0,5.34-1,15,15,0,0,0,27.5,0,14.6,14.6,0,0,0,5.34,1c8.44,0,15.27-7.16,15.27-16a15.57,15.57,0,0,0-.13-2.05A16.16,16.16,0,0,0,84,44Z'/>
        <path fill={color} d='M60.08,39.1,43,16.13a1,1,0,0,0-1.77,0l-17.08,23a1,1,0,0,0,.35,1.4l17.08,8.69a1,1,0,0,0,1.08,0L59.74,40.5A1,1,0,0,0,60.08,39.1Zm-1.4,8.25L42.74,56.47a1.18,1.18,0,0,1-1.25,0L25.55,47.35A.41.41,0,0,0,25,48L41.14,68a1.19,1.19,0,0,0,2,0L59.21,48A.41.41,0,0,0,58.68,47.35Z'/>
      </svg>
    )
  }
  render () {
    return (
      <Container onClick={e => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseOver={e => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseEnter={e => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseLeave={e => {
        e.preventDefault()
        e.stopPropagation()
      }}>
        <div 
          style={{ pointerEvents: 'auto', paddingTop: '2px' }}
          onMouseOver={e => {
            e.preventDefault()
            e.stopPropagation()
            const pos = e.target.getBoundingClientRect()
            const position = { x: pos.x, y: pos.y }
            this.store.setLayerPop({ position, active: true, userId: this.props.userId, created: Date.now() })
          }
        }>
          {this.badge(16)}
        </div>
      </Container>
  )}
}

const insertAfter = (newNode, referenceNode) => {
  return referenceNode.parentNode.insertBefore(newNode, referenceNode)
}

const usersChecked = []

let currentTheme = ''

const callback = function (mutationsList) {
  const composeTweet = document.querySelectorAll('[data-testid=SideNav_NewTweet_Button]')[0]
  const { backgroundColor } = window.getComputedStyle(document.body)
  if (currentTheme !== backgroundColor) {
    store.setTheme(themes(backgroundColor))
    currentTheme = backgroundColor
  }

  mutationsList.forEach(async mutation => {
    if (mutation.type === 'childList') {
      if (mutation.addedNodes.length > 0) {
        const addedNode = mutation.addedNodes[0]

        updateHeaderBadge(addedNode)

        const tweet = addedNode.querySelector('[data-testid=primaryColumn] [data-testid=tweet]')
        if (tweet) {
          const { ensName, handle, nameSection } = findNameSectionInTweet(tweet)

          if (ensName && !tweet.querySelector('.__frameMount__')) {
            insertBadge(nameSection, ensName, handle)
          }
        }
      }
    }
  })
}

updateHeaderBadge(root)

const observer = new MutationObserver(callback)
observer.observe(root, config)

// observer.disconnect()
