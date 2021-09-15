const scan = async (address) => {
  const inventory = {}
  if (!address) return inventory
  const getSet = async (address, offset) => {
    const url = `https://api.opensea.io/api/v1/assets?owner=${address}&order_direction=desc&offset=${offset}&limit=50`
    const options = { method: 'GET' }
    const set = await (await fetch(url, options)).json()
    set?.assets?.forEach(a => {
      inventory[a.id] = a
    })
    if (set?.assets?.length === 50) await getSet(address, offset + 50)
  }
  
  await getSet(address, 0)
  return inventory
}

export default async (address) => {
  let i = await scan(address)
  const inventory = {}
  let a = Object.keys(i).forEach(a => {
    const { collection } = i[a]
    if (!inventory[collection.slug]) {
      inventory[collection.slug] = {
        meta: {
          name: collection.name,
          description: collection.description,
          img: collection.featured_image_url,
          imgLarge: collection.large_image_url
        },
        assets: {}
      }
    }
    const { name, id, token_id, image_url, image_thumbnail_url, animation_url, description, external_link, permalink, traits, asset_contract, display_data } = i[a]
    inventory[collection.slug].assets[id] = { 
      name, 
      id,
      tokenId: token_id,
      thumbnail: image_thumbnail_url || image_url,
      img: image_url, 
      animation: animation_url,
      description, 
      link: external_link,
      display: display_data,
      openSeaLink: permalink,
      traits,
      contract: {
        address: asset_contract.address,
        type: asset_contract.asset_contract_type,
        created: asset_contract.created,
        name: asset_contract.name,
        owner: asset_contract.owner, 
        schema: asset_contract.schema_name,
        description: asset_contract.description,
        img: asset_contract.image_url,
        link: asset_contract.external_link
      },

    }
  })
  return inventory
}
