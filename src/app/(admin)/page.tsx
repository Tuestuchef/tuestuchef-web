import { requireSessionUser } from "@/common/lib/services/session.service"
import HomeScreen from "@/modules/home/screens/home-screen"

export default async function HomePage() {
  const user = await requireSessionUser()

  return <HomeScreen user={user} />
}
