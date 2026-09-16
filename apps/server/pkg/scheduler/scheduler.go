package scheduler

func StartScheduler() {
	go RecycleExpiredClientScheduler()
}
