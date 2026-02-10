import { getRiders } from "./actions"
import { RidersClient } from "./riders-client"

export default async function RidersPage() {
  const riders = await getRiders()

  return <RidersClient riders={riders} />
}
