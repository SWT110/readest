function expand_big() {
document.getElementsByClassName("pic_thumb")[0].setAttribute("style","display:none");
document.getElementsByClassName("big_pic")[0].setAttribute("style","display:block");
}

function expand_thumb() {
    document.getElementsByClassName("pic_thumb")[0].setAttribute("style","display:block");
    document.getElementsByClassName("big_pic")[0].setAttribute("style","display:none");
}