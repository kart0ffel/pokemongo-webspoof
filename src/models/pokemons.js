import { computed, observable, action } from 'mobx'
import axios from 'axios'

import Alert from 'react-s-alert'

import userLocation from './user-location.js'

const request = window.require('request-promise-native')

class Pokemons {

  // reference to `updatePokemonSpotsLoop` setTimeout
  timeout = null

  @observable ip = null
  @observable pokemonSpots = []
  @observable status = 'unknown'

  @observable excluded = [
    'pidgey', 'poliwag', 'caterpie', 'zubat', 'staryu',
    'rattata', 'spearow', 'goldeen', 'weedle', 'pinsir',
    'kakuna', 'golbat', 'drowzee', 'raticate', 'fearow',
    'krabby', 'bellsprout', 'psyduck', 'magikarp', 'tentacool',
    'jigglypuff', 'paras', 'oddish', 'pidgeotto', 'doduo', 'dodrio'
  ]

  @computed get spots() {
    return this.pokemonSpots.filter(
      ({ pokemon_id }) =>
        !this.excluded.includes(pokemon_id.toLowerCase())
    )
  }

  @action setIPAddress = async () => {
    try {
      const { data: { ip } } = await axios.get('https://api.ipify.org?format=json')
      this.ip = ip

      this.getPokemons()
    } catch (error) {
      console.warn('could not find IP, retry in 10s')
      console.warn(error)

      setTimeout(::this.setIPAddress, 10 * 1000)
    }
  }

  @action getPokemons = async () => {
    const [ latitude, longitude ] = userLocation

    // dont query pokémon spots until we have a location
    // retry in 3seconds
    if (!latitude || !longitude) {
      return setTimeout(() => this.getPokemons(), 3 * 1000)
    }

    try {
      const baseURL = 'https://cache.fastpokemap.se/?key=allow-all&ts=0&compute='
      const uri = `${baseURL}${this.ip}&lat=${latitude}&lng=${longitude}`

      /* eslint max-len: 0 */
      const headers = {
        pragma: 'no-cache',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2858.0 Safari/537.36',
        'cache-control': 'no-cache',
        origin: 'https://fastpokemap.se',
        authority: 'cache.fastpokemap.se'
      }

      const pokemons = await request({ uri, headers, json: true })

      // replace pokémon spots by new one :+1:
      this.status = 'online'
      this.pokemonSpots.replace(this.calcTimeLeft(pokemons))
    } catch (error) {
      Alert.warning(`
        <strong>Could not get Pokémons spots</strong>
        <div class="stack">${error}</div>
      `, { timeout: 2000 })

      console.warn(error)

      this.status = 'offline'
    }

    // refresh pokémon spots every 45s
    setTimeout(::this.getPokemons, 45 * 1000)
  }

  // loop to run every 500ms to update timeLeft before de-spawn
  // of the pokémon, and remove the old one.
  @action updatePokemonSpotsLoop = () => {
    const updatedSpots = this.calcTimeLeft(this.pokemonSpots)
    this.pokemonSpots.replace(updatedSpots)

    // clear old timeout
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    this.timemout = setTimeout(this.updatePokemonSpotsLoop, 5 * 1000)
  }

  // calc human readable `timeLeft` from `expiration_time`
  calcTimeLeft = (spots) => spots.reduce((result, curr) => {
    const { expireAt } = curr

    const diff = new Date(expireAt) - new Date()

    // pokémon spawn expired, remove it from list
    if (diff < 0) return result

    // update timeleft
    const minutesLeft = ((diff / 1000 / 60) << 0).toFixed()
    const secondsLeft = ((diff / 1000) % 60).toFixed()
    const timeLeft = `${minutesLeft}m ${secondsLeft}s`

    return [ ...result, { ...curr, timeLeft } ]
  }, [])

}

// start getting pokemons positions
const pokemons = new Pokemons()
pokemons.setIPAddress()
pokemons.updatePokemonSpotsLoop()

export default pokemons