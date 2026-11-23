import "./friends.css";

const friends = ["one", "two", "three"] as const;

export default function NumberFriends() {
  return (
    <div className="nr-friends" aria-hidden="true">
      <div className="nr-friends-stage">
        <i className="nr-cloud cloud-left" /><i className="nr-cloud cloud-right" />
        <i className="nr-spark spark-one" /><i className="nr-spark spark-two" />
        <i className="nr-spark spark-three" /><i className="nr-spark spark-four" />
        <i className="nr-sprinkle sprinkle-one" /><i className="nr-sprinkle sprinkle-two" />
        <i className="nr-sprinkle sprinkle-three" /><i className="nr-sprinkle sprinkle-four" />
        {friends.map((friend, index) => (
          <div key={friend} className={`nr-friend friend-${friend}`}>
            <i className="nr-shadow" />
            <div className="nr-body">
              <i className="nr-limb arm-left" /><i className="nr-limb arm-right" />
              <i className="nr-foot foot-left" /><i className="nr-foot foot-right" />
              <b className="nr-digit">{index + 1}</b>
              <span className="nr-face">
                <i className="nr-eye eye-left" /><i className="nr-eye eye-right" />
                <i className="nr-cheek cheek-left" /><i className="nr-cheek cheek-right" />
                <i className="nr-smile" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
