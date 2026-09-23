ARG ROCKY_BASE=rockylinux:9
FROM ${ROCKY_BASE}

RUN dnf install -y systemd \
    && command -v systemctl \
    && test -x /sbin/init \
    && dnf clean all

CMD ["/sbin/init"]
