export default function Loader({ small = false, title = "Loading..." }) {
  return <span className={small ? "loader-small" : "loader"} title={title}></span>;
}
